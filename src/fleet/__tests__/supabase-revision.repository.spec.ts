import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import {
  SupabaseRevisionRepository,
  throwRevisionRpcError,
} from '../repositories/supabase-revision.repository.js';
import type { RevisionItems } from '../domain/revision.entity.js';
import { REVISION_ITEM_KEYS } from '../domain/revision.enums.js';

const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const REVISION_ID = '66666666-6666-4666-8666-666666666666';
const USER_ID = '77777777-7777-4777-8777-777777777777';

/** Fluent thenable mock for Supabase query builders. */
function createQueryMock(resolved: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = new Proxy(chain, {
    get(target, prop: string) {
      if (prop === 'then') {
        return (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve(resolved).then(resolve, reject);
      }
      if (!target[prop]) {
        target[prop] = vi.fn().mockReturnValue(self);
      }
      return target[prop];
    },
  });
  return self;
}

const items = Object.fromEntries(
  REVISION_ITEM_KEYS.map((key) => [key, { estado: 'OK', comentario: null }]),
) as RevisionItems;

const row = {
  id: REVISION_ID,
  vehiculo_id: VEHICLE_ID,
  items: { ...items, frenos: { estado: 'CRITICO', comentario: 'Sin presión' } },
  comentario_general: 'Rutina',
  creado_en: '2026-11-01T12:00:00.000Z',
  autor: { id: USER_ID, nombre: 'Lucía', apellido: 'Ríos' },
};

describe('SupabaseRevisionRepository', () => {
  let repo: SupabaseRevisionRepository;
  let from: ReturnType<typeof vi.fn>;
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    from = vi.fn();
    rpc = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseRevisionRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from, rpc }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseRevisionRepository);
  });

  it('mapea la fila con el autor (nombre y apellido)', async () => {
    from.mockReturnValue(createQueryMock({ data: row, error: null }));
    const revision = await repo.findById(VEHICLE_ID, REVISION_ID);
    expect(revision).toMatchObject({
      id: REVISION_ID,
      vehiculoId: VEHICLE_ID,
      frenos: { estado: 'CRITICO', comentario: 'Sin presión' },
      nivelAceite: { estado: 'OK', comentario: null },
      comentarioGeneral: 'Rutina',
      revisadoPor: { id: USER_ID, nombre: 'Lucía Ríos' },
      creadoEn: '2026-11-01T12:00:00.000Z',
    });
  });

  it('sin autor (revisiones viejas) devuelve revisadoPor null', async () => {
    from.mockReturnValue(
      createQueryMock({ data: { ...row, autor: null }, error: null }),
    );
    const revision = await repo.findLatestByVehicleId(VEHICLE_ID);
    expect(revision?.revisadoPor).toBeNull();
  });

  it('findById filtra por móvil y por id', async () => {
    const query = createQueryMock({ data: null, error: null });
    from.mockReturnValue(query);
    await expect(repo.findById(VEHICLE_ID, REVISION_ID)).resolves.toBeNull();
    expect(query.eq).toHaveBeenCalledWith('id', REVISION_ID);
    expect(query.eq).toHaveBeenCalledWith('vehiculo_id', VEHICLE_ID);
  });

  it('create guarda todo con la función transaccional y devuelve la revisión', async () => {
    rpc.mockResolvedValue({ data: REVISION_ID, error: null });
    from.mockReturnValue(createQueryMock({ data: row, error: null }));

    const revision = await repo.create({
      vehiculoId: VEHICLE_ID,
      items,
      comentarioGeneral: null,
      revisadoPor: USER_ID,
      estadoNuevo: 'OPERATIVO',
    });

    expect(rpc).toHaveBeenCalledWith('registrar_revision_vehiculo', {
      p_vehiculo_id: VEHICLE_ID,
      p_items: items,
      p_comentario_general: null,
      p_revisado_por: USER_ID,
      p_estado_nuevo: 'OPERATIVO',
    });
    expect(revision.id).toBe(REVISION_ID);
  });

  it('create traduce el error de la función (en mantenimiento sin comentario)', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'COMENTARIO_OBLIGATORIO' },
    });
    await expect(
      repo.create({
        vehiculoId: VEHICLE_ID,
        items,
        comentarioGeneral: null,
        revisadoPor: null,
        estadoNuevo: 'OPERATIVO',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(from).not.toHaveBeenCalled();
  });

  it('findByVehicleId cuenta, pagina y ordena de la más nueva a la más vieja', async () => {
    const count = createQueryMock({ count: 12, error: null });
    const page = createQueryMock({ data: [row], error: null });
    from.mockReturnValueOnce(count).mockReturnValueOnce(page);

    const result = await repo.findByVehicleId(VEHICLE_ID, 2, 10);

    expect(result.total).toBe(12);
    expect(result.items).toHaveLength(1);
    expect(page.order).toHaveBeenCalledWith('creado_en', { ascending: false });
    expect(page.range).toHaveBeenCalledWith(10, 19);
  });

  it('findByVehicleId sin revisiones no hace la segunda consulta', async () => {
    from.mockReturnValueOnce(createQueryMock({ count: 0, error: null }));
    await expect(repo.findByVehicleId(VEHICLE_ID, 1, 10)).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe('throwRevisionRpcError', () => {
  it('móvil inexistente → 404', () => {
    expect(() =>
      throwRevisionRpcError({ code: 'P0001', message: 'VEHICULO_NO_EXISTE' }),
    ).toThrow(NotFoundException);
  });

  it('dado de baja → 409', () => {
    expect(() =>
      throwRevisionRpcError({
        code: 'P0001',
        message: 'VEHICULO_DADO_DE_BAJA',
      }),
    ).toThrow(ConflictException);
  });

  it('en mantenimiento sin comentario → 400 con el campo', () => {
    try {
      throwRevisionRpcError({
        code: 'P0001',
        message: 'COMENTARIO_OBLIGATORIO',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({
        campo: 'comentarioGeneral',
        code: 'COMENTARIO_OBLIGATORIO',
      });
    }
  });

  it('otros errores pasan por el mapeo general', () => {
    expect(() =>
      throwRevisionRpcError({ code: 'XX000', message: 'boom' }),
    ).toThrow(InternalServerErrorException);
  });
});

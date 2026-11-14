import 'reflect-metadata';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { SupabaseCompartmentRepository } from '../repositories/supabase-compartment.repository.js';
import { CompartmentInUseError } from '../domain/compartment.repository.js';

const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const C1 = '88888888-8888-4888-8888-888888888881';

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
      if (!target[prop]) target[prop] = vi.fn().mockReturnValue(self);
      return target[prop];
    },
  });
  return self;
}

const row = (over: Record<string, unknown> = {}) => ({
  id: C1,
  vehiculo_id: VEHICLE_ID,
  zona: 'LADO_CONDUCTOR',
  nombre: 'LC-1',
  orden: 1,
  estado: 'OPERATIVO',
  creado_en: '2026-11-13T12:00:00.000Z',
  actualizado_en: '2026-11-13T12:00:00.000Z',
  ...over,
});

describe('SupabaseCompartmentRepository', () => {
  let repo: SupabaseCompartmentRepository;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    from = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseCompartmentRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseCompartmentRepository);
  });

  it('mapea las filas y las ordena como el plano (zona y posición)', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: [
          row({ id: 'te', zona: 'TECHO', nombre: 'TE-1' }),
          row({ id: 'lc2', nombre: 'LC-2', orden: 2 }),
          row({ id: 'lc1' }),
        ],
        error: null,
      }),
    );
    const list = await repo.findByVehicleId(VEHICLE_ID);
    expect(list.map((c) => c.nombre)).toEqual(['LC-1', 'LC-2', 'TE-1']);
    expect(list[0]).toMatchObject({
      vehiculoId: VEHICLE_ID,
      estado: 'OPERATIVO',
      creadoEn: expect.any(String),
    });
  });

  it('findById filtra por móvil y por id', async () => {
    const q = createQueryMock({ data: null, error: null });
    from.mockReturnValue(q);
    await expect(repo.findById(VEHICLE_ID, C1)).resolves.toBeNull();
    expect(q.eq).toHaveBeenCalledWith('id', C1);
    expect(q.eq).toHaveBeenCalledWith('vehiculo_id', VEHICLE_ID);
  });

  it('createMany inserta todo en una sola llamada', async () => {
    const q = createQueryMock({ data: [row()], error: null });
    from.mockReturnValue(q);
    await repo.createMany(VEHICLE_ID, [
      { zona: 'LADO_CONDUCTOR', nombre: 'LC-1', orden: 1 },
    ]);
    expect(q.insert).toHaveBeenCalledWith([
      {
        vehiculo_id: VEHICLE_ID,
        zona: 'LADO_CONDUCTOR',
        nombre: 'LC-1',
        orden: 1,
      },
    ]);
  });

  it('un nombre repetido en la base → 409 en el campo nombre', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      }),
    );
    try {
      await repo.createMany(VEHICLE_ID, [
        { zona: 'TRASERO', nombre: 'TR-1', orden: 1 },
      ]);
      throw new Error('se esperaba un error');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({
        campo: 'nombre',
      });
    }
  });

  it('update escribe los cambios y la fecha de actualización', async () => {
    const q = createQueryMock({
      data: row({ estado: 'FUERA_DE_USO' }),
      error: null,
    });
    from.mockReturnValue(q);
    await expect(
      repo.update(VEHICLE_ID, C1, { estado: 'FUERA_DE_USO' }),
    ).resolves.toMatchObject({
      estado: 'FUERA_DE_USO',
    });
    expect(q.update).toHaveBeenCalledWith({
      estado: 'FUERA_DE_USO',
      actualizado_en: expect.any(String),
    });
  });

  it('delete devuelve si borró algo', async () => {
    from.mockReturnValueOnce(
      createQueryMock({ data: [{ id: C1 }], error: null }),
    );
    await expect(repo.delete(VEHICLE_ID, C1)).resolves.toBe(true);
    from.mockReturnValueOnce(createQueryMock({ data: [], error: null }));
    await expect(repo.delete(VEHICLE_ID, C1)).resolves.toBe(false);
  });

  it('delete con algo que lo referencia (materiales) → CompartmentInUseError', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: null,
        error: { code: '23503', message: 'still referenced' },
      }),
    );
    await expect(repo.delete(VEHICLE_ID, C1)).rejects.toBeInstanceOf(
      CompartmentInUseError,
    );
  });

  it('otros errores pasan por el mapeo general', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: null,
        error: { code: 'XX000', message: 'boom' },
      }),
    );
    await expect(repo.findByVehicleId(VEHICLE_ID)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import {
  buildVehicleSearchFilter,
  SupabaseEmergencyVehicleRepository,
} from '../repositories/supabase-emergency-vehicle.repository.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';

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

const listRow = {
  id: VEHICLE_ID,
  estado: 'OPERATIVO' as const,
  patente: 'AB123CD',
  denominacion: 'Unidad 1',
  motivo_baja: null,
  tipo_id: TIPO_ID,
  tipo_valor: 'Ambulancia',
  marca_id: MARCA_ID,
  marca_valor: 'Ford',
  modelo_id: MODELO_ID,
  modelo_valor: 'Ranger',
};

const mappedVehicle = {
  id: VEHICLE_ID,
  estado: 'OPERATIVO',
  patente: 'AB123CD',
  denominacion: 'Unidad 1',
  tipo: { id: TIPO_ID, valor: 'Ambulancia' },
  marca: { id: MARCA_ID, valor: 'Ford' },
  modelo: { id: MODELO_ID, valor: 'Ranger', marcaId: MARCA_ID },
  motivoBaja: null,
};

describe('buildVehicleSearchFilter', () => {
  it('busca por denominación, clave de denominación y patente', () => {
    expect(buildVehicleSearchFilter('AB123')).toBe(
      'denominacion.ilike."%AB123%",denominacion_clave.ilike."%AB123%",patente.ilike."%AB123%"',
    );
  });

  it('normaliza el término de patente (las patentes se guardan canónicas)', () => {
    expect(buildVehicleSearchFilter('ab 123')).toBe(
      'denominacion.ilike."%ab 123%",denominacion_clave.ilike."%AB123%",patente.ilike."%AB123%"',
    );
  });

  it.each(['m1', 'M 1', 'm-1', 'M.1'])(
    '"%s" busca la clave M1, así encuentra M-1',
    (busqueda) => {
      expect(buildVehicleSearchFilter(busqueda)).toContain(
        'denominacion_clave.ilike."%M1%"',
      );
    },
  );

  it('no filtra por patente si el término no tiene letras ni números', () => {
    expect(buildVehicleSearchFilter('-')).toBe('denominacion.ilike."%-%"');
  });

  it('retorna null si queda vacío tras sanitizar', () => {
    expect(buildVehicleSearchFilter('"%*')).toBeNull();
  });
});

describe('SupabaseEmergencyVehicleRepository', () => {
  let repo: SupabaseEmergencyVehicleRepository;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    from = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseEmergencyVehicleRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseEmergencyVehicleRepository);
  });

  it('findById lee la vista y mapea catálogos embebidos', async () => {
    from.mockReturnValue(createQueryMock({ data: listRow, error: null }));
    await expect(repo.findById(VEHICLE_ID)).resolves.toEqual(mappedVehicle);
    expect(from).toHaveBeenCalledWith('vehiculos_emergencia_listado');

    from.mockReturnValue(createQueryMock({ data: null, error: null }));
    await expect(repo.findById(VEHICLE_ID)).resolves.toBeNull();
  });

  it('findAll retorna vacío si total es 0', async () => {
    from.mockReturnValue(
      createQueryMock({ data: null, error: null, count: 0 }),
    );
    await expect(
      repo.findAll({
        ordenPor: 'denominacion',
        orden: 'asc',
        pagina: 1,
        porPagina: 20,
      }),
    ).resolves.toEqual({ items: [], total: 0 });
    expect(from).toHaveBeenCalledWith('vehiculos_emergencia_listado');
  });

  it('findAll lista desde la vista y mapea', async () => {
    from
      .mockReturnValueOnce(
        createQueryMock({ data: null, error: null, count: 1 }),
      )
      .mockReturnValueOnce(createQueryMock({ data: [listRow], error: null }));

    const result = await repo.findAll({
      ordenPor: 'patente',
      orden: 'desc',
      pagina: 1,
      porPagina: 20,
      estado: 'OPERATIVO',
      tipoId: TIPO_ID,
      busqueda: 'Unidad',
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(mappedVehicle);
    expect(from).toHaveBeenCalledWith('vehiculos_emergencia_listado');
  });

  it('create inserta y re-fetch desde la vista', async () => {
    from
      .mockReturnValueOnce(
        createQueryMock({ data: { id: VEHICLE_ID }, error: null }),
      )
      .mockReturnValueOnce(createQueryMock({ data: listRow, error: null }));

    await expect(
      repo.create({
        patente: 'AB123CD',
        denominacion: 'Unidad 1',
        tipoId: TIPO_ID,
        marcaId: MARCA_ID,
        modeloId: MODELO_ID,
      }),
    ).resolves.toEqual(mappedVehicle);
    expect(from).toHaveBeenNthCalledWith(1, 'vehiculos_emergencia');
    expect(from).toHaveBeenNthCalledWith(2, 'vehiculos_emergencia_listado');
  });

  it('create mapea patente duplicada a ConflictException', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
    );
    await expect(
      repo.create({
        patente: 'AB123CD',
        denominacion: 'X',
        tipoId: TIPO_ID,
        marcaId: MARCA_ID,
        modeloId: MODELO_ID,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('update retorna null si no hay fila (baja o inexistente)', async () => {
    from.mockReturnValue(createQueryMock({ data: null, error: null }));
    await expect(
      repo.update(VEHICLE_ID, {
        patente: 'AB123CD',
        denominacion: 'X',
        tipoId: TIPO_ID,
        marcaId: MARCA_ID,
        modeloId: MODELO_ID,
      }),
    ).resolves.toBeNull();
  });

  it('markAsWrittenOff actualiza y re-fetch enriquecido', async () => {
    const writtenOffRow = {
      ...listRow,
      estado: 'BAJA_DEFINITIVA' as const,
      motivo_baja: 'Fin de vida',
    };
    from
      .mockReturnValueOnce(
        createQueryMock({ data: { id: VEHICLE_ID }, error: null }),
      )
      .mockReturnValueOnce(
        createQueryMock({ data: writtenOffRow, error: null }),
      );

    await expect(
      repo.markAsWrittenOff(VEHICLE_ID, 'Fin de vida'),
    ).resolves.toEqual({
      ...mappedVehicle,
      estado: 'BAJA_DEFINITIVA',
      motivoBaja: 'Fin de vida',
    });
  });

  it('existsByType/Brand/Model consultan la tabla', async () => {
    from.mockReturnValue(
      createQueryMock({ data: [{ id: VEHICLE_ID }], error: null }),
    );
    await expect(repo.existsByType(TIPO_ID)).resolves.toBe(true);
    from.mockReturnValue(createQueryMock({ data: [], error: null }));
    await expect(repo.existsByBrand(MARCA_ID)).resolves.toBe(false);
    from.mockReturnValue(
      createQueryMock({ data: [{ id: VEHICLE_ID }], error: null }),
    );
    await expect(repo.existsByModel(MODELO_ID)).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('vehiculos_emergencia');
  });

  it('countByStatus cuenta cada estado activo', async () => {
    const counts: Record<string, number> = {
      OPERATIVO: 4,
      MANTENIMIENTO: 2,
      OBSERVACIONES: 1,
      FUERA_SERVICIO: 0,
    };
    from.mockImplementation(() => {
      const query = createQueryMock(undefined) as unknown as {
        eq: ReturnType<typeof vi.fn>;
      };
      query.eq.mockImplementation((_col: string, estado: string) =>
        createQueryMock({ count: counts[estado], error: null }),
      );
      return query;
    });

    await expect(repo.countByStatus()).resolves.toEqual({
      total: 7,
      porEstado: counts,
    });
    expect(from).toHaveBeenCalledWith('vehiculos_emergencia');
  });

  it('findIdByPatente devuelve el id o null', async () => {
    const q = createQueryMock({ data: { id: VEHICLE_ID }, error: null });
    from.mockReturnValue(q);
    await expect(repo.findIdByPatente('AB123CD')).resolves.toBe(VEHICLE_ID);
    expect(q.eq).toHaveBeenCalledWith('patente', 'AB123CD');

    from.mockReturnValue(createQueryMock({ data: null, error: null }));
    await expect(repo.findIdByPatente('AB123CD')).resolves.toBeNull();
  });

  it('findActiveIdByDenominationKey filtra por clave y excluye bajas', async () => {
    const q = createQueryMock({ data: { id: VEHICLE_ID }, error: null });
    from.mockReturnValue(q);
    await expect(repo.findActiveIdByDenominationKey('M1')).resolves.toBe(
      VEHICLE_ID,
    );
    expect(q.eq).toHaveBeenCalledWith('denominacion_clave', 'M1');
    expect(q.neq).toHaveBeenCalledWith('estado', 'BAJA_DEFINITIVA');
  });

  it('findActiveDenominationsByCatalog devuelve las denominaciones', async () => {
    const q = createQueryMock({
      data: [{ denominacion: 'M-1' }, { denominacion: 'M-2' }],
      error: null,
    });
    from.mockReturnValue(q);
    await expect(
      repo.findActiveDenominationsByCatalog('marca_id', MARCA_ID),
    ).resolves.toEqual(['M-1', 'M-2']);
    expect(q.eq).toHaveBeenCalledWith('marca_id', MARCA_ID);
    expect(q.neq).toHaveBeenCalledWith('estado', 'BAJA_DEFINITIVA');
  });

  it('countActiveByCatalog cuenta móviles activos por tipo, marca y modelo', async () => {
    from.mockReturnValue(
      createQueryMock({
        data: [
          { tipo_id: TIPO_ID, marca_id: MARCA_ID, modelo_id: MODELO_ID },
          { tipo_id: TIPO_ID, marca_id: MARCA_ID, modelo_id: 'otro' },
        ],
        error: null,
      }),
    );
    await expect(repo.countActiveByCatalog()).resolves.toEqual({
      tipos: { [TIPO_ID]: 2 },
      marcas: { [MARCA_ID]: 2 },
      modelos: { [MODELO_ID]: 1, otro: 1 },
    });
  });
});

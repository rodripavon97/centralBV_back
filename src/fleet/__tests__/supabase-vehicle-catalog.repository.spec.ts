import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { SupabaseVehicleCatalogRepository } from '../repositories/supabase-vehicle-catalog.repository.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

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

describe('SupabaseVehicleCatalogRepository', () => {
  let repo: SupabaseVehicleCatalogRepository;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    from = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseVehicleCatalogRepository,
        {
          provide: SupabaseService,
          useValue: { getAdminClient: () => ({ from }) },
        },
      ],
    }).compile();
    repo = module.get(SupabaseVehicleCatalogRepository);
  });

  describe('tipos', () => {
    it('findTypes lista activos y mapea', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: [{ id: TIPO_ID, valor: 'Ambulancia' }],
          error: null,
        }),
      );
      await expect(repo.findTypes()).resolves.toEqual([
        { id: TIPO_ID, valor: 'Ambulancia' },
      ]);
      expect(from).toHaveBeenCalledWith('tipos_vehiculo');
    });

    it('createType inserta y mapea', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: { id: TIPO_ID, valor: 'Motobomba' },
          error: null,
        }),
      );
      await expect(repo.createType('Motobomba')).resolves.toEqual({
        id: TIPO_ID,
        valor: 'Motobomba',
      });
    });

    it('updateType lanza NotFound si no hay fila activa', async () => {
      from.mockReturnValue(createQueryMock({ data: null, error: null }));
      await expect(repo.updateType(MISSING_ID, 'X')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deactivateType lanza NotFound si no hay fila activa', async () => {
      from.mockReturnValue(createQueryMock({ data: null, error: null }));
      await expect(repo.deactivateType(MISSING_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createType mapea unique a ConflictException', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        }),
      );
      await expect(repo.createType('Ambulancia')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('marcas', () => {
    it('findBrands lista activos', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: [{ id: MARCA_ID, valor: 'Ford' }],
          error: null,
        }),
      );
      await expect(repo.findBrands()).resolves.toEqual([
        { id: MARCA_ID, valor: 'Ford' },
      ]);
      expect(from).toHaveBeenCalledWith('marcas_vehiculo');
    });

    it('createBrand e updateBrand mapean', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: { id: MARCA_ID, valor: 'Ford' },
          error: null,
        }),
      );
      await expect(repo.createBrand('Ford')).resolves.toEqual({
        id: MARCA_ID,
        valor: 'Ford',
      });
      await expect(repo.updateBrand(MARCA_ID, 'Ford')).resolves.toEqual({
        id: MARCA_ID,
        valor: 'Ford',
      });
    });

    it('deactivateBrand completa cuando hay fila', async () => {
      from.mockReturnValue(
        createQueryMock({ data: { id: MARCA_ID }, error: null }),
      );
      await expect(repo.deactivateBrand(MARCA_ID)).resolves.toBeUndefined();
    });
  });

  describe('modelos', () => {
    it('findModels mapea marca_id a marcaId', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: [{ id: MODELO_ID, valor: 'Ranger', marca_id: MARCA_ID }],
          error: null,
        }),
      );
      await expect(repo.findModels()).resolves.toEqual([
        { id: MODELO_ID, valor: 'Ranger', marcaId: MARCA_ID },
      ]);
      expect(from).toHaveBeenCalledWith('modelos_vehiculo');
    });

    it('createModel inserta con marca_id', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: { id: MODELO_ID, valor: 'Ranger', marca_id: MARCA_ID },
          error: null,
        }),
      );
      await expect(repo.createModel('Ranger', MARCA_ID)).resolves.toEqual({
        id: MODELO_ID,
        valor: 'Ranger',
        marcaId: MARCA_ID,
      });
    });

    it('updateModel lanza NotFound si no hay fila activa', async () => {
      from.mockReturnValue(createQueryMock({ data: null, error: null }));
      await expect(repo.updateModel(MISSING_ID, 'X')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createModel mapea FK inválida a ConflictException', async () => {
      from.mockReturnValue(
        createQueryMock({
          data: null,
          error: { code: '23503', message: 'foreign key' },
        }),
      );
      await expect(repo.createModel('Ranger', MISSING_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

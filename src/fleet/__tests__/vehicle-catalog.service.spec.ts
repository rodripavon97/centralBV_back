import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  VehicleCatalogService,
  inUseMessage,
} from '../vehicle-catalog.service.js';
import { VEHICLE_CATALOG_REPOSITORY } from '../domain/vehicle-catalog.repository.js';
import { EMERGENCY_VEHICLE_REPOSITORY } from '../domain/emergency-vehicle.repository.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '55555555-5555-4555-8555-555555555555';

describe('VehicleCatalogService', () => {
  let service: VehicleCatalogService;
  let catalog: {
    findTypes: ReturnType<typeof vi.fn>;
    createType: ReturnType<typeof vi.fn>;
    updateType: ReturnType<typeof vi.fn>;
    deactivateType: ReturnType<typeof vi.fn>;
    findBrands: ReturnType<typeof vi.fn>;
    createBrand: ReturnType<typeof vi.fn>;
    updateBrand: ReturnType<typeof vi.fn>;
    deactivateBrand: ReturnType<typeof vi.fn>;
    findModels: ReturnType<typeof vi.fn>;
    createModel: ReturnType<typeof vi.fn>;
    updateModel: ReturnType<typeof vi.fn>;
    deactivateModel: ReturnType<typeof vi.fn>;
  };
  let vehicles: {
    findActiveDenominationsByCatalog: ReturnType<typeof vi.fn>;
    countActiveByCatalog: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    catalog = {
      findTypes: vi.fn().mockResolvedValue([]),
      createType: vi.fn(),
      updateType: vi.fn(),
      deactivateType: vi.fn(),
      findBrands: vi.fn().mockResolvedValue([]),
      createBrand: vi.fn(),
      updateBrand: vi.fn(),
      deactivateBrand: vi.fn(),
      findModels: vi.fn().mockResolvedValue([]),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deactivateModel: vi.fn(),
    };
    vehicles = {
      findActiveDenominationsByCatalog: vi.fn().mockResolvedValue([]),
      countActiveByCatalog: vi
        .fn()
        .mockResolvedValue({ tipos: {}, marcas: {}, modelos: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleCatalogService,
        { provide: VEHICLE_CATALOG_REPOSITORY, useValue: catalog },
        { provide: EMERGENCY_VEHICLE_REPOSITORY, useValue: vehicles },
      ],
    }).compile();

    service = module.get(VehicleCatalogService);
  });

  describe('nombres', () => {
    it('rechaza nombre vacío o solo espacios en createType', async () => {
      await expect(service.createType('   ')).rejects.toThrow(
        BadRequestException,
      );
      expect(catalog.createType).not.toHaveBeenCalled();
    });

    it('trimmea y colapsa espacios antes de crear', async () => {
      catalog.createType.mockResolvedValue({ id: TIPO_ID, valor: 'Ambulancia' });
      await service.createType('  Transporte   de personal  ');
      expect(catalog.createType).toHaveBeenCalledWith('Transporte de personal');
    });

    it('rechaza un tipo repetido sin importar mayúsculas ni acentos', async () => {
      catalog.findTypes.mockResolvedValue([{ id: TIPO_ID, valor: 'Camión' }]);
      await expect(service.createType('camion')).rejects.toThrow(
        'Ya existe un tipo con ese nombre',
      );
      expect(catalog.createType).not.toHaveBeenCalled();
    });

    it('permite renombrar un ítem a su mismo nombre con otras mayúsculas', async () => {
      catalog.findBrands.mockResolvedValue([{ id: MARCA_ID, valor: 'ford' }]);
      catalog.updateBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
      await service.updateBrand(MARCA_ID, 'Ford');
      expect(catalog.updateBrand).toHaveBeenCalledWith(MARCA_ID, 'Ford');
    });

    it('rechaza renombrar una marca al nombre de otra', async () => {
      catalog.findBrands.mockResolvedValue([
        { id: MARCA_ID, valor: 'Ford' },
        { id: OTHER_ID, valor: 'Iveco' },
      ]);
      await expect(service.updateBrand(MARCA_ID, 'IVECO')).rejects.toThrow(
        'Ya existe una marca con ese nombre',
      );
    });

    it('el nombre de modelo solo choca dentro de la misma marca', async () => {
      catalog.findModels.mockResolvedValue([
        { id: MODELO_ID, valor: 'Master', marcaId: OTHER_ID },
      ]);
      catalog.createModel.mockResolvedValue({
        id: 'nuevo',
        valor: 'Master',
        marcaId: MARCA_ID,
      });
      await service.createModel('Master', MARCA_ID);
      expect(catalog.createModel).toHaveBeenCalledWith('Master', MARCA_ID);

      await expect(service.createModel('master', OTHER_ID)).rejects.toThrow(
        'Ya existe un modelo con ese nombre para esa marca',
      );
    });
  });

  describe('listados con uso', () => {
    it('agrega enUso a tipos, marcas y modelos (0 si no tiene móviles)', async () => {
      catalog.findTypes.mockResolvedValue([{ id: TIPO_ID, valor: 'Autobomba' }]);
      catalog.findBrands.mockResolvedValue([
        { id: MARCA_ID, valor: 'Ford' },
        { id: OTHER_ID, valor: 'Volkswagen' },
      ]);
      catalog.findModels.mockResolvedValue([
        { id: MODELO_ID, valor: 'F-350', marcaId: MARCA_ID },
      ]);
      vehicles.countActiveByCatalog.mockResolvedValue({
        tipos: { [TIPO_ID]: 3 },
        marcas: { [MARCA_ID]: 2 },
        modelos: { [MODELO_ID]: 1 },
      });

      await expect(service.findTypes()).resolves.toEqual([
        { id: TIPO_ID, valor: 'Autobomba', enUso: 3 },
      ]);
      await expect(service.findBrands()).resolves.toEqual([
        { id: MARCA_ID, valor: 'Ford', enUso: 2 },
        { id: OTHER_ID, valor: 'Volkswagen', enUso: 0 },
      ]);
      await expect(service.findModels()).resolves.toEqual([
        { id: MODELO_ID, valor: 'F-350', marcaId: MARCA_ID, enUso: 1 },
      ]);
    });
  });

  describe('desactivar', () => {
    it('bloquea un tipo en uso y nombra los móviles', async () => {
      catalog.findTypes.mockResolvedValue([{ id: TIPO_ID, valor: 'Rescate' }]);
      vehicles.findActiveDenominationsByCatalog.mockResolvedValue(['M-3']);
      await expect(service.deactivateType(TIPO_ID)).rejects.toThrow(
        new ConflictException(
          'No se puede eliminar Rescate: la usa 1 móvil (M-3).',
        ),
      );
      expect(vehicles.findActiveDenominationsByCatalog).toHaveBeenCalledWith(
        'tipo_id',
        TIPO_ID,
      );
      expect(catalog.deactivateType).not.toHaveBeenCalled();
    });

    it('desactiva un tipo sin móviles activos', async () => {
      catalog.deactivateType.mockResolvedValue(undefined);
      await service.deactivateType(TIPO_ID);
      expect(catalog.deactivateType).toHaveBeenCalledWith(TIPO_ID);
    });

    it('bloquea una marca en uso', async () => {
      catalog.findBrands.mockResolvedValue([{ id: MARCA_ID, valor: 'Ford' }]);
      vehicles.findActiveDenominationsByCatalog.mockResolvedValue(['M-1', 'M-2']);
      await expect(service.deactivateBrand(MARCA_ID)).rejects.toThrow(
        'No se puede eliminar Ford: la usan 2 móviles (M-1, M-2).',
      );
      expect(vehicles.findActiveDenominationsByCatalog).toHaveBeenCalledWith(
        'marca_id',
        MARCA_ID,
      );
      expect(catalog.deactivateBrand).not.toHaveBeenCalled();
    });

    it('desactiva una marca sin móviles activos', async () => {
      catalog.deactivateBrand.mockResolvedValue(undefined);
      await service.deactivateBrand(MARCA_ID);
      expect(catalog.deactivateBrand).toHaveBeenCalledWith(MARCA_ID);
    });

    it('bloquea un modelo en uso', async () => {
      vehicles.findActiveDenominationsByCatalog.mockResolvedValue(['M-4']);
      await expect(service.deactivateModel(MODELO_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(vehicles.findActiveDenominationsByCatalog).toHaveBeenCalledWith(
        'modelo_id',
        MODELO_ID,
      );
      expect(catalog.deactivateModel).not.toHaveBeenCalled();
    });

    it('desactiva un modelo sin móviles activos', async () => {
      catalog.deactivateModel.mockResolvedValue(undefined);
      await service.deactivateModel(MODELO_ID);
      expect(catalog.deactivateModel).toHaveBeenCalledWith(MODELO_ID);
    });
  });

  describe('inUseMessage', () => {
    it('lista hasta 3 móviles y resume el resto', () => {
      expect(inUseMessage('Ford', ['M-1', 'M-2', 'M-3', 'M-4', 'M-5'])).toBe(
        'No se puede eliminar Ford: la usan 5 móviles (M-1, M-2, M-3 y 2 más).',
      );
    });
  });

  it('delega create/update de marcas y modelos', async () => {
    catalog.createBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
    catalog.updateBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
    catalog.createModel.mockResolvedValue({
      id: MODELO_ID,
      valor: 'Ranger',
      marcaId: MARCA_ID,
    });
    catalog.updateModel.mockResolvedValue({
      id: MODELO_ID,
      valor: 'Ranger',
      marcaId: MARCA_ID,
    });

    await expect(service.createBrand('Ford')).resolves.toEqual({
      id: MARCA_ID,
      valor: 'Ford',
    });
    await expect(service.updateBrand(MARCA_ID, 'Ford')).resolves.toEqual({
      id: MARCA_ID,
      valor: 'Ford',
    });
    await expect(service.createModel('Ranger', MARCA_ID)).resolves.toEqual({
      id: MODELO_ID,
      valor: 'Ranger',
      marcaId: MARCA_ID,
    });
    await expect(service.updateModel(MODELO_ID, 'Ranger')).resolves.toEqual({
      id: MODELO_ID,
      valor: 'Ranger',
      marcaId: MARCA_ID,
    });
  });
});

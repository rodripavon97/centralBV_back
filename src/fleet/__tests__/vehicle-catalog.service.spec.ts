import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VehicleCatalogService } from '../vehicle-catalog.service.js';
import { VEHICLE_CATALOG_REPOSITORY } from '../domain/vehicle-catalog.repository.js';
import { EMERGENCY_VEHICLE_REPOSITORY } from '../domain/emergency-vehicle.repository.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';

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
    existsByType: ReturnType<typeof vi.fn>;
    existsByBrand: ReturnType<typeof vi.fn>;
    existsByModel: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    catalog = {
      findTypes: vi.fn(),
      createType: vi.fn(),
      updateType: vi.fn(),
      deactivateType: vi.fn(),
      findBrands: vi.fn(),
      createBrand: vi.fn(),
      updateBrand: vi.fn(),
      deactivateBrand: vi.fn(),
      findModels: vi.fn(),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deactivateModel: vi.fn(),
    };
    vehicles = {
      existsByType: vi.fn(),
      existsByBrand: vi.fn(),
      existsByModel: vi.fn(),
      findById: vi.fn(),
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

    it('trimmea el nombre antes de crear', async () => {
      catalog.createType.mockResolvedValue({ id: TIPO_ID, valor: 'Ambulancia' });
      await service.createType('  Ambulancia  ');
      expect(catalog.createType).toHaveBeenCalledWith('Ambulancia');
    });
  });

  describe('deactivateType', () => {
    it('bloquea si hay vehículos asociados', async () => {
      vehicles.existsByType.mockResolvedValue(true);
      await expect(service.deactivateType(TIPO_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(catalog.deactivateType).not.toHaveBeenCalled();
    });

    it('desactiva si no hay vehículos asociados', async () => {
      vehicles.existsByType.mockResolvedValue(false);
      catalog.deactivateType.mockResolvedValue(undefined);
      await service.deactivateType(TIPO_ID);
      expect(catalog.deactivateType).toHaveBeenCalledWith(TIPO_ID);
    });
  });

  describe('deactivateBrand', () => {
    it('bloquea si hay vehículos asociados', async () => {
      vehicles.existsByBrand.mockResolvedValue(true);
      await expect(service.deactivateBrand(MARCA_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(catalog.deactivateBrand).not.toHaveBeenCalled();
    });

    it('desactiva si no hay vehículos asociados', async () => {
      vehicles.existsByBrand.mockResolvedValue(false);
      catalog.deactivateBrand.mockResolvedValue(undefined);
      await service.deactivateBrand(MARCA_ID);
      expect(catalog.deactivateBrand).toHaveBeenCalledWith(MARCA_ID);
    });
  });

  describe('deactivateModel', () => {
    it('bloquea si hay vehículos asociados', async () => {
      vehicles.existsByModel.mockResolvedValue(true);
      await expect(service.deactivateModel(MODELO_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(catalog.deactivateModel).not.toHaveBeenCalled();
    });

    it('desactiva si no hay vehículos asociados', async () => {
      vehicles.existsByModel.mockResolvedValue(false);
      catalog.deactivateModel.mockResolvedValue(undefined);
      await service.deactivateModel(MODELO_ID);
      expect(catalog.deactivateModel).toHaveBeenCalledWith(MODELO_ID);
    });
  });

  it('delega find/create/update de marcas y modelos', async () => {
    catalog.findBrands.mockResolvedValue([]);
    catalog.createBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
    catalog.updateBrand.mockResolvedValue({ id: MARCA_ID, valor: 'Ford' });
    catalog.findModels.mockResolvedValue([]);
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

    await expect(service.findBrands()).resolves.toEqual([]);
    await expect(service.createBrand('Ford')).resolves.toEqual({
      id: MARCA_ID,
      valor: 'Ford',
    });
    await expect(service.updateBrand(MARCA_ID, 'Ford')).resolves.toEqual({
      id: MARCA_ID,
      valor: 'Ford',
    });
    await expect(service.findModels()).resolves.toEqual([]);
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

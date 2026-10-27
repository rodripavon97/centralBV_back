import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FleetService } from '../fleet.service.js';
import { EMERGENCY_VEHICLE_REPOSITORY } from '../domain/emergency-vehicle.repository.js';
import { VEHICLE_CATALOG_REPOSITORY } from '../domain/vehicle-catalog.repository.js';
import type { EmergencyVehicle } from '../domain/emergency-vehicle.entity.js';
import { CreateEmergencyVehicleDto } from '../dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from '../dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from '../dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from '../dtos/write-off-emergency-vehicle.dto.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BRAND_ID = '55555555-5555-4555-8555-555555555555';

const vehicleFixture = (
  overrides: Partial<EmergencyVehicle> = {},
): EmergencyVehicle => ({
  id: VEHICLE_ID,
  estado: 'OPERATIVO',
  patente: 'AB123CD',
  denominacion: 'Unidad 1',
  tipo: { id: TIPO_ID, valor: 'Ambulancia' },
  marca: { id: MARCA_ID, valor: 'Ford' },
  modelo: { id: MODELO_ID, valor: 'Ranger', marcaId: MARCA_ID },
  motivoBaja: null,
  ...overrides,
});

const createDto = () =>
  Object.assign(new CreateEmergencyVehicleDto(), {
    patente: 'AB123CD',
    denominacion: 'Unidad 1',
    tipoId: TIPO_ID,
    marcaId: MARCA_ID,
    modeloId: MODELO_ID,
  });

describe('FleetService', () => {
  let service: FleetService;
  let vehicles: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    markAsWrittenOff: ReturnType<typeof vi.fn>;
    existsByType: ReturnType<typeof vi.fn>;
    existsByBrand: ReturnType<typeof vi.fn>;
    existsByModel: ReturnType<typeof vi.fn>;
  };
  let catalog: {
    findTypes: ReturnType<typeof vi.fn>;
    findBrands: ReturnType<typeof vi.fn>;
    findModels: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vehicles = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      markAsWrittenOff: vi.fn(),
      existsByType: vi.fn(),
      existsByBrand: vi.fn(),
      existsByModel: vi.fn(),
    };
    catalog = {
      findTypes: vi.fn().mockResolvedValue([{ id: TIPO_ID, valor: 'Ambulancia' }]),
      findBrands: vi.fn().mockResolvedValue([{ id: MARCA_ID, valor: 'Ford' }]),
      findModels: vi
        .fn()
        .mockResolvedValue([
          { id: MODELO_ID, valor: 'Ranger', marcaId: MARCA_ID },
        ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FleetService,
        { provide: EMERGENCY_VEHICLE_REPOSITORY, useValue: vehicles },
        { provide: VEHICLE_CATALOG_REPOSITORY, useValue: catalog },
      ],
    }).compile();

    service = module.get(FleetService);
  });

  describe('findAll', () => {
    it('devuelve respuesta paginada', async () => {
      const items = [vehicleFixture()];
      vehicles.findAll.mockResolvedValue({ items, total: 1 });
      const query = Object.assign(new ListEmergencyVehiclesDto(), {
        pagina: 1,
        porPagina: 20,
        ordenPor: 'denominacion',
        orden: 'asc',
      });
      const result = await service.findAll(query);
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.pagina).toBe(1);
      expect(vehicles.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: 1, porPagina: 20 }),
      );
    });
  });

  describe('findById', () => {
    it('retorna el vehículo', async () => {
      const vehicle = vehicleFixture();
      vehicles.findById.mockResolvedValue(vehicle);
      await expect(service.findById(VEHICLE_ID)).resolves.toEqual(vehicle);
    });

    it('lanza NotFound si no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(service.findById(VEHICLE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('crea con catálogo válido', async () => {
      const created = vehicleFixture();
      vehicles.create.mockResolvedValue(created);
      await expect(service.create(createDto())).resolves.toEqual(created);
      expect(vehicles.create).toHaveBeenCalledWith({
        patente: 'AB123CD',
        denominacion: 'Unidad 1',
        tipoId: TIPO_ID,
        marcaId: MARCA_ID,
        modeloId: MODELO_ID,
      });
    });

    it('rechaza catálogo inválido', async () => {
      catalog.findTypes.mockResolvedValue([]);
      await expect(service.create(createDto())).rejects.toThrow(
        BadRequestException,
      );
      expect(vehicles.create).not.toHaveBeenCalled();
    });

    it('rechaza modelo que no pertenece a la marca', async () => {
      catalog.findModels.mockResolvedValue([
        { id: MODELO_ID, valor: 'Ranger', marcaId: OTHER_BRAND_ID },
      ]);
      await expect(service.create(createDto())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('actualiza datos generales', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      const updated = vehicleFixture({ denominacion: 'Unidad 2' });
      vehicles.update.mockResolvedValue(updated);
      const dto = Object.assign(new UpdateEmergencyVehicleDto(), {
        ...createDto(),
        denominacion: 'Unidad 2',
      });
      await expect(service.update(VEHICLE_ID, dto)).resolves.toEqual(updated);
    });

    it('lanza NotFound si no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(
        service.update(VEHICLE_ID, createDto() as UpdateEmergencyVehicleDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si ya está de baja', async () => {
      vehicles.findById.mockResolvedValue(
        vehicleFixture({ estado: 'BAJA_DEFINITIVA', motivoBaja: 'Fin' }),
      );
      await expect(
        service.update(VEHICLE_ID, createDto() as UpdateEmergencyVehicleDto),
      ).rejects.toThrow(ConflictException);
      expect(vehicles.update).not.toHaveBeenCalled();
    });
  });

  describe('writeOff', () => {
    const dto = Object.assign(new WriteOffEmergencyVehicleDto(), {
      motivo: 'Fin de vida útil',
    });

    it('da de baja con motivo', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      const writtenOff = vehicleFixture({
        estado: 'BAJA_DEFINITIVA',
        motivoBaja: dto.motivo,
      });
      vehicles.markAsWrittenOff.mockResolvedValue(writtenOff);
      await expect(service.writeOff(VEHICLE_ID, dto)).resolves.toEqual(
        writtenOff,
      );
      expect(vehicles.markAsWrittenOff).toHaveBeenCalledWith(
        VEHICLE_ID,
        dto.motivo,
      );
    });

    it('lanza NotFound si no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(service.writeOff(VEHICLE_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza si ya está de baja', async () => {
      vehicles.findById.mockResolvedValue(
        vehicleFixture({ estado: 'BAJA_DEFINITIVA', motivoBaja: 'Ya' }),
      );
      await expect(service.writeOff(VEHICLE_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(vehicles.markAsWrittenOff).not.toHaveBeenCalled();
    });
  });
});

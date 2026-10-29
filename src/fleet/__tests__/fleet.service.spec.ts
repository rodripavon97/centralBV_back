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

const createDto = (overrides: Partial<CreateEmergencyVehicleDto> = {}) =>
  Object.assign(new CreateEmergencyVehicleDto(), {
    patente: 'AB123CD',
    denominacion: 'M-1',
    tipoId: TIPO_ID,
    marcaId: MARCA_ID,
    modeloId: MODELO_ID,
    ...overrides,
  });

/** Body (status + error) of the HttpException a promise rejects with. */
const errorBody = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => {
      throw new Error('se esperaba un error');
    },
    (e: unknown) => e,
  );
  const http = error as { getStatus(): number; getResponse(): unknown };
  return { status: http.getStatus(), body: http.getResponse() };
};

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
    findIdByPatente: ReturnType<typeof vi.fn>;
    findActiveIdByDenominationKey: ReturnType<typeof vi.fn>;
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
      findIdByPatente: vi.fn().mockResolvedValue(null),
      findActiveIdByDenominationKey: vi.fn().mockResolvedValue(null),
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
        denominacion: 'M-1',
        tipoId: TIPO_ID,
        marcaId: MARCA_ID,
        modeloId: MODELO_ID,
      });
    });

    it('guarda patente y denominación normalizadas', async () => {
      vehicles.create.mockResolvedValue(vehicleFixture());
      await service.create(
        createDto({ patente: ' ab 123-cd ', denominacion: ' m 4 ' }),
      );
      expect(vehicles.create).toHaveBeenCalledWith(
        expect.objectContaining({ patente: 'AB123CD', denominacion: 'M-4' }),
      );
      expect(vehicles.findIdByPatente).toHaveBeenCalledWith('AB123CD');
      expect(vehicles.findActiveIdByDenominationKey).toHaveBeenCalledWith('M4');
    });

    it('deja igual una denominación que no es letras + número', async () => {
      vehicles.create.mockResolvedValue(vehicleFixture());
      await service.create(createDto({ denominacion: 'ab-04' }));
      expect(vehicles.create).toHaveBeenCalledWith(
        expect.objectContaining({ denominacion: 'AB-04' }),
      );
    });

    it('rechaza patente duplicada aunque esté escrita distinto', async () => {
      vehicles.findIdByPatente.mockResolvedValue('otro-id');
      const { status, body } = await errorBody(
        service.create(createDto({ patente: 'ab 123 cd' })),
      );
      expect(status).toBe(409);
      expect(body).toEqual({
        message: 'Ya existe un móvil con esa patente',
        campo: 'patente',
        code: 'PATENTE_DUPLICADA',
      });
      expect(vehicles.create).not.toHaveBeenCalled();
    });

    it('rechaza denominación duplicada entre móviles activos (M1 = M-1)', async () => {
      vehicles.findActiveIdByDenominationKey.mockResolvedValue('otro-id');
      const { status, body } = await errorBody(
        service.create(createDto({ denominacion: 'M1' })),
      );
      expect(status).toBe(409);
      expect(body).toEqual({
        message: 'Ya existe un móvil con esa denominación',
        campo: 'denominacion',
        code: 'DENOMINACION_DUPLICADA',
      });
    });

    it('pide confirmación para una patente de formato desconocido', async () => {
      const { status, body } = await errorBody(
        service.create(createDto({ patente: 'BV-01' })),
      );
      expect(status).toBe(400);
      expect(body).toEqual(
        expect.objectContaining({
          campo: 'patente',
          code: 'PATENTE_FORMATO_DESCONOCIDO',
        }),
      );
      expect(vehicles.create).not.toHaveBeenCalled();
    });

    it('guarda una patente especial confirmada', async () => {
      vehicles.create.mockResolvedValue(vehicleFixture({ patente: 'BV01' }));
      await service.create(
        createDto({ patente: 'bv-01', confirmarPatenteEspecial: true }),
      );
      expect(vehicles.create).toHaveBeenCalledWith(
        expect.objectContaining({ patente: 'BV01' }),
      );
    });

    it('rechaza patente vacía después de normalizar o fuera de largo', async () => {
      await expect(service.create(createDto({ patente: ' - . ' }))).rejects.toThrow(
        'La patente es obligatoria',
      );
      await expect(
        service.create(createDto({ patente: 'A'.repeat(13) })),
      ).rejects.toThrow('La patente debe tener entre 2 y 12 letras o números');
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
      const updated = vehicleFixture({ denominacion: 'M-2' });
      vehicles.update.mockResolvedValue(updated);
      const dto = Object.assign(
        new UpdateEmergencyVehicleDto(),
        createDto({ denominacion: 'M-2' }),
      );
      await expect(service.update(VEHICLE_ID, dto)).resolves.toEqual(updated);
    });

    it('no choca consigo mismo al buscar duplicados', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      vehicles.findIdByPatente.mockResolvedValue(VEHICLE_ID);
      vehicles.findActiveIdByDenominationKey.mockResolvedValue(VEHICLE_ID);
      vehicles.update.mockResolvedValue(vehicleFixture());
      await service.update(
        VEHICLE_ID,
        createDto() as UpdateEmergencyVehicleDto,
      );
      expect(vehicles.update).toHaveBeenCalled();
    });

    it('no vuelve a pedir confirmación si la patente especial no cambió', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture({ patente: 'BV01' }));
      vehicles.update.mockResolvedValue(vehicleFixture({ patente: 'BV01' }));
      await service.update(
        VEHICLE_ID,
        createDto({ patente: 'BV 01' }) as UpdateEmergencyVehicleDto,
      );
      expect(vehicles.update).toHaveBeenCalledWith(
        VEHICLE_ID,
        expect.objectContaining({ patente: 'BV01' }),
      );
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

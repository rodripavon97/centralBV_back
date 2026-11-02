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
import { REVISION_REPOSITORY } from '../domain/revision.repository.js';
import type { EmergencyVehicle } from '../domain/emergency-vehicle.entity.js';
import type { Revision } from '../domain/revision.entity.js';
import { REVISION_ITEM_KEYS } from '../domain/revision.enums.js';
import { CreateEmergencyVehicleDto } from '../dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from '../dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from '../dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from '../dtos/write-off-emergency-vehicle.dto.js';
import {
  CreateRevisionDto,
  ItemRevisionDto,
} from '../dtos/create-revision.dto.js';
import { ListRevisionsDto } from '../dtos/list-revisions.dto.js';

const TIPO_ID = '11111111-1111-4111-8111-111111111111';
const MARCA_ID = '22222222-2222-4222-8222-222222222222';
const MODELO_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BRAND_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '77777777-7777-4777-8777-777777777777';

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
    countByStatus: ReturnType<typeof vi.fn>;
  };
  let catalog: {
    findTypes: ReturnType<typeof vi.fn>;
    findBrands: ReturnType<typeof vi.fn>;
    findModels: ReturnType<typeof vi.fn>;
  };
  let revisions: {
    create: ReturnType<typeof vi.fn>;
    findLatestByVehicleId: ReturnType<typeof vi.fn>;
    findByVehicleId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };

  const itemOk = () =>
    Object.assign(new ItemRevisionDto(), { estado: 'OK', comentario: null });

  const revisionDto = (
    overrides: Partial<CreateRevisionDto> = {},
  ): CreateRevisionDto => {
    const items = Object.fromEntries(
      REVISION_ITEM_KEYS.map((key) => [key, itemOk()]),
    );
    return Object.assign(new CreateRevisionDto(), {
      ...items,
      comentarioGeneral: null,
      ...overrides,
    });
  };

  const revisionFixture = (overrides: Partial<Revision> = {}): Revision => ({
    id: '66666666-6666-4666-8666-666666666666',
    vehiculoId: VEHICLE_ID,
    nivelAceite: { estado: 'OK', comentario: null },
    frenos: { estado: 'OK', comentario: null },
    refrigerante: { estado: 'OK', comentario: null },
    bateria: { estado: 'OK', comentario: null },
    presionNeumaticos: { estado: 'OK', comentario: null },
    lucesYBalizas: { estado: 'OK', comentario: null },
    sirenaYComunicaciones: { estado: 'OK', comentario: null },
    comentarioGeneral: null,
    revisadoPor: { id: USER_ID, nombre: 'Lucía Ríos' },
    creadoEn: '2026-11-01T12:00:00.000Z',
    ...overrides,
  });

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
      countByStatus: vi.fn(),
    };
    catalog = {
      findTypes: vi
        .fn()
        .mockResolvedValue([{ id: TIPO_ID, valor: 'Ambulancia' }]),
      findBrands: vi.fn().mockResolvedValue([{ id: MARCA_ID, valor: 'Ford' }]),
      findModels: vi
        .fn()
        .mockResolvedValue([
          { id: MODELO_ID, valor: 'Ranger', marcaId: MARCA_ID },
        ]),
    };
    revisions = {
      create: vi.fn(),
      findLatestByVehicleId: vi.fn(),
      findByVehicleId: vi.fn(),
      findById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FleetService,
        { provide: EMERGENCY_VEHICLE_REPOSITORY, useValue: vehicles },
        { provide: VEHICLE_CATALOG_REPOSITORY, useValue: catalog },
        { provide: REVISION_REPOSITORY, useValue: revisions },
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
      await expect(
        service.create(createDto({ patente: ' - . ' })),
      ).rejects.toThrow('La patente es obligatoria');
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

  describe('summary', () => {
    it('delega en el repositorio', async () => {
      const resumen = {
        total: 3,
        porEstado: {
          OPERATIVO: 2,
          MANTENIMIENTO: 1,
          OBSERVACIONES: 0,
          FUERA_SERVICIO: 0,
        },
      };
      vehicles.countByStatus.mockResolvedValue(resumen);
      await expect(service.summary()).resolves.toEqual(resumen);
    });
  });

  describe('createRevision', () => {
    const critico = (comentario: string) =>
      Object.assign(new ItemRevisionDto(), { estado: 'CRITICO', comentario });
    const advertencia = (comentario: string) =>
      Object.assign(new ItemRevisionDto(), {
        estado: 'ADVERTENCIA',
        comentario,
      });

    it('todo OK → OPERATIVO, con quién la registró, en una sola llamada', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      const created = revisionFixture();
      revisions.create.mockResolvedValue(created);

      await expect(
        service.createRevision(VEHICLE_ID, revisionDto(), USER_ID),
      ).resolves.toEqual(created);
      expect(revisions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          vehiculoId: VEHICLE_ID,
          revisadoPor: USER_ID,
          estadoNuevo: 'OPERATIVO',
          comentarioGeneral: null,
        }),
      );
    });

    it('ADVERTENCIA → OBSERVACIONES', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      revisions.create.mockResolvedValue(revisionFixture());

      await service.createRevision(
        VEHICLE_ID,
        revisionDto({ frenos: advertencia('pastillas al límite') }),
        USER_ID,
      );
      expect(revisions.create).toHaveBeenCalledWith(
        expect.objectContaining({ estadoNuevo: 'OBSERVACIONES' }),
      );
    });

    it('CRITICO → FUERA_SERVICIO', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      revisions.create.mockResolvedValue(revisionFixture());

      await service.createRevision(
        VEHICLE_ID,
        revisionDto({ bateria: critico('no arranca') }),
        USER_ID,
      );
      expect(revisions.create).toHaveBeenCalledWith(
        expect.objectContaining({ estadoNuevo: 'FUERA_SERVICIO' }),
      );
    });

    it('el comentario de un ítem OK no se guarda', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      revisions.create.mockResolvedValue(revisionFixture());

      await service.createRevision(
        VEHICLE_ID,
        revisionDto({
          nivelAceite: Object.assign(new ItemRevisionDto(), {
            estado: 'OK',
            comentario: 'sobra',
          }),
        }),
        null,
      );
      const data = revisions.create.mock.calls[0][0];
      expect(data.items.nivelAceite).toEqual({
        estado: 'OK',
        comentario: null,
      });
      expect(data.revisadoPor).toBeNull();
    });

    it('404 si el móvil no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(
        service.createRevision(VEHICLE_ID, revisionDto(), USER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(revisions.create).not.toHaveBeenCalled();
    });

    it('409 si está de baja', async () => {
      vehicles.findById.mockResolvedValue(
        vehicleFixture({ estado: 'BAJA_DEFINITIVA', motivoBaja: 'Fin' }),
      );
      await expect(
        service.createRevision(VEHICLE_ID, revisionDto(), USER_ID),
      ).rejects.toThrow(ConflictException);
      expect(revisions.create).not.toHaveBeenCalled();
    });

    it('en mantenimiento pide el comentario general (campo comentarioGeneral)', async () => {
      vehicles.findById.mockResolvedValue(
        vehicleFixture({ estado: 'MANTENIMIENTO' }),
      );
      const { status, body } = await errorBody(
        service.createRevision(
          VEHICLE_ID,
          revisionDto({ comentarioGeneral: '   ' }),
          USER_ID,
        ),
      );
      expect(status).toBe(400);
      expect(body).toMatchObject({
        campo: 'comentarioGeneral',
        code: 'COMENTARIO_OBLIGATORIO',
      });
      expect(revisions.create).not.toHaveBeenCalled();
    });

    it('en mantenimiento con comentario y todo OK vuelve a OPERATIVO', async () => {
      vehicles.findById.mockResolvedValue(
        vehicleFixture({ estado: 'MANTENIMIENTO' }),
      );
      revisions.create.mockResolvedValue(revisionFixture());

      await service.createRevision(
        VEHICLE_ID,
        revisionDto({ comentarioGeneral: '  Cambio de pastillas  ' }),
        USER_ID,
      );
      expect(revisions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          estadoNuevo: 'OPERATIVO',
          comentarioGeneral: 'Cambio de pastillas',
        }),
      );
    });
  });

  describe('findRevisions', () => {
    it('devuelve el historial paginado', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      const items = [revisionFixture(), revisionFixture({ id: 'otra' })];
      revisions.findByVehicleId.mockResolvedValue({ items, total: 12 });

      await expect(
        service.findRevisions(
          VEHICLE_ID,
          Object.assign(new ListRevisionsDto(), { pagina: 2, porPagina: 10 }),
        ),
      ).resolves.toEqual({
        items,
        total: 12,
        pagina: 2,
        paginas: 2,
        porPagina: 10,
      });
      expect(revisions.findByVehicleId).toHaveBeenCalledWith(VEHICLE_ID, 2, 10);
    });

    it('404 si el móvil no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(
        service.findRevisions(VEHICLE_ID, new ListRevisionsDto()),
      ).rejects.toThrow(NotFoundException);
      expect(revisions.findByVehicleId).not.toHaveBeenCalled();
    });
  });

  describe('findRevision', () => {
    it('devuelve la revisión del móvil', async () => {
      const revision = revisionFixture();
      revisions.findById.mockResolvedValue(revision);
      await expect(
        service.findRevision(VEHICLE_ID, revision.id),
      ).resolves.toEqual(revision);
      expect(revisions.findById).toHaveBeenCalledWith(VEHICLE_ID, revision.id);
    });

    it('404 si no existe o es de otro móvil', async () => {
      revisions.findById.mockResolvedValue(null);
      await expect(service.findRevision(VEHICLE_ID, 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLatestRevision', () => {
    it('devuelve la última revisión', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      const latest = revisionFixture();
      revisions.findLatestByVehicleId.mockResolvedValue(latest);
      await expect(service.findLatestRevision(VEHICLE_ID)).resolves.toEqual(
        latest,
      );
    });

    it('404 si el móvil no existe', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(service.findLatestRevision(VEHICLE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404 si no hay revisiones', async () => {
      vehicles.findById.mockResolvedValue(vehicleFixture());
      revisions.findLatestByVehicleId.mockResolvedValue(null);
      await expect(service.findLatestRevision(VEHICLE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

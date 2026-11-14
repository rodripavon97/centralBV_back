import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompartmentService } from '../compartment.service.js';
import { EMERGENCY_VEHICLE_REPOSITORY } from '../domain/emergency-vehicle.repository.js';
import {
  COMPARTMENT_REPOSITORY,
  CompartmentInUseError,
} from '../domain/compartment.repository.js';
import type { EmergencyVehicle } from '../domain/emergency-vehicle.entity.js';
import type { Compartment } from '../domain/compartment.entity.js';
import { GenerateCompartmentsDto } from '../dtos/generate-compartments.dto.js';
import { CreateCompartmentDto } from '../dtos/create-compartment.dto.js';
import { UpdateCompartmentDto } from '../dtos/update-compartment.dto.js';

const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const C1 = '88888888-8888-4888-8888-888888888881';
const C2 = '88888888-8888-4888-8888-888888888882';

const vehicle = (
  overrides: Partial<EmergencyVehicle> = {},
): EmergencyVehicle => ({
  id: VEHICLE_ID,
  estado: 'OPERATIVO',
  patente: 'AB123CD',
  denominacion: 'R-01',
  tipo: { id: 't', valor: 'Rescate' },
  marca: { id: 'm', valor: 'Ford' },
  modelo: { id: 'mo', valor: 'F-350', marcaId: 'm' },
  motivoBaja: null,
  ...overrides,
});

const compartment = (overrides: Partial<Compartment> = {}): Compartment => ({
  id: C1,
  vehiculoId: VEHICLE_ID,
  zona: 'LADO_CONDUCTOR',
  nombre: 'LC-1',
  orden: 1,
  estado: 'OPERATIVO',
  creadoEn: '2026-11-13T12:00:00.000Z',
  actualizadoEn: '2026-11-13T12:00:00.000Z',
  ...overrides,
});

const generateDto = (overrides: Partial<GenerateCompartmentsDto> = {}) =>
  Object.assign(new GenerateCompartmentsDto(), {
    ladoConductor: 5,
    ladoAcompanante: 2,
    trasero: 1,
    techo: true,
    cabina: false,
    ...overrides,
  });

/** Status and body of the HttpException a promise rejects with. */
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

describe('CompartmentService', () => {
  let service: CompartmentService;
  let vehicles: { findById: ReturnType<typeof vi.fn> };
  let repo: {
    findByVehicleId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vehicles = { findById: vi.fn().mockResolvedValue(vehicle()) };
    repo = {
      findByVehicleId: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompartmentService,
        { provide: EMERGENCY_VEHICLE_REPOSITORY, useValue: vehicles },
        { provide: COMPARTMENT_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(CompartmentService);
  });

  describe('list', () => {
    it('devuelve los buches del móvil', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment()]);
      await expect(service.list(VEHICLE_ID)).resolves.toHaveLength(1);
    });

    it('móvil inexistente → 404', async () => {
      vehicles.findById.mockResolvedValue(null);
      await expect(service.list(VEHICLE_ID)).rejects.toThrow(NotFoundException);
    });

    it('un móvil dado de baja se puede leer', async () => {
      vehicles.findById.mockResolvedValue(
        vehicle({ estado: 'BAJA_DEFINITIVA' }),
      );
      await expect(service.list(VEHICLE_ID)).resolves.toEqual([]);
    });
  });

  describe('generate', () => {
    it('crea los 9 buches del ejemplo de Figma de una vez', async () => {
      repo.createMany.mockImplementation((_id, drafts) =>
        Promise.resolve(drafts),
      );
      const created = await service.generate(VEHICLE_ID, generateDto());
      expect(repo.createMany).toHaveBeenCalledTimes(1);
      expect(created).toHaveLength(9);
      expect(repo.createMany.mock.calls[0][1][0]).toEqual({
        zona: 'LADO_CONDUCTOR',
        nombre: 'LC-1',
        orden: 1,
      });
    });

    it('si el móvil ya tiene buches → 409', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment()]);
      const { status, body } = await errorBody(
        service.generate(VEHICLE_ID, generateDto()),
      );
      expect(status).toBe(409);
      expect(body).toMatchObject({ code: 'COMPARTIMENTOS_YA_GENERADOS' });
      expect(repo.createMany).not.toHaveBeenCalled();
    });

    it('todo en cero → 400', async () => {
      await expect(
        service.generate(
          VEHICLE_ID,
          generateDto({
            ladoConductor: 0,
            ladoAcompanante: 0,
            trasero: 0,
            techo: false,
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('móvil dado de baja → 409', async () => {
      vehicles.findById.mockResolvedValue(
        vehicle({ estado: 'BAJA_DEFINITIVA' }),
      );
      await expect(service.generate(VEHICLE_ID, generateDto())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('create', () => {
    it('normaliza el nombre y lo pone al final de su zona', async () => {
      repo.findByVehicleId.mockResolvedValue([
        compartment(),
        compartment({ id: C2, nombre: 'LC-2', orden: 2 }),
      ]);
      repo.createMany.mockImplementation((_id, drafts) =>
        Promise.resolve(drafts),
      );
      await service.create(
        VEHICLE_ID,
        Object.assign(new CreateCompartmentDto(), {
          nombre: ' lc-6 ',
          zona: 'LADO_CONDUCTOR',
        }),
      );
      expect(repo.createMany).toHaveBeenCalledWith(VEHICLE_ID, [
        { zona: 'LADO_CONDUCTOR', nombre: 'LC-6', orden: 3 },
      ]);
    });

    it('nombre repetido (sin importar mayúsculas) → 409 en el campo nombre', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment({ nombre: 'LC-1' })]);
      const { status, body } = await errorBody(
        service.create(
          VEHICLE_ID,
          Object.assign(new CreateCompartmentDto(), {
            nombre: 'lc-1',
            zona: 'TRASERO',
          }),
        ),
      );
      expect(status).toBe(409);
      expect(body).toMatchObject({
        campo: 'nombre',
        code: 'COMPARTIMENTO_DUPLICADO',
        message: 'Ya existe un buche con ese nombre',
      });
    });
  });

  describe('update', () => {
    it('renombra sin chocar consigo mismo', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment()]);
      repo.update.mockResolvedValue(compartment({ nombre: 'LC-1 BIS' }));
      await service.update(
        VEHICLE_ID,
        C1,
        Object.assign(new UpdateCompartmentDto(), { nombre: 'lc-1 bis' }),
      );
      expect(repo.update).toHaveBeenCalledWith(VEHICLE_ID, C1, {
        nombre: 'LC-1 BIS',
      });
    });

    it('cambiar de zona lo manda al final de la zona nueva', async () => {
      repo.findByVehicleId.mockResolvedValue([
        compartment(),
        compartment({ id: C2, zona: 'TRASERO', nombre: 'TR-1', orden: 1 }),
      ]);
      repo.update.mockResolvedValue(compartment({ zona: 'TRASERO', orden: 2 }));
      await service.update(
        VEHICLE_ID,
        C1,
        Object.assign(new UpdateCompartmentDto(), { zona: 'TRASERO' }),
      );
      expect(repo.update).toHaveBeenCalledWith(VEHICLE_ID, C1, {
        zona: 'TRASERO',
        orden: 2,
      });
    });

    it('sin cambios no escribe', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment()]);
      await expect(
        service.update(
          VEHICLE_ID,
          C1,
          Object.assign(new UpdateCompartmentDto(), {
            nombre: 'lc-1',
            zona: 'LADO_CONDUCTOR',
          }),
        ),
      ).resolves.toMatchObject({ id: C1 });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('nombre de otro buche → 409', async () => {
      repo.findByVehicleId.mockResolvedValue([
        compartment(),
        compartment({ id: C2, nombre: 'LC-2', orden: 2 }),
      ]);
      await expect(
        service.update(
          VEHICLE_ID,
          C1,
          Object.assign(new UpdateCompartmentDto(), { nombre: 'LC-2' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('sin nombre ni zona → 400', async () => {
      await expect(
        service.update(VEHICLE_ID, C1, new UpdateCompartmentDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('buche de otro móvil o inexistente → 404', async () => {
      repo.findByVehicleId.mockResolvedValue([compartment()]);
      await expect(
        service.update(
          VEHICLE_ID,
          C2,
          Object.assign(new UpdateCompartmentDto(), { nombre: 'X' }),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setStatus', () => {
    it('cambia el estado del buche y no toca el del móvil', async () => {
      repo.update.mockResolvedValue(compartment({ estado: 'FUERA_DE_USO' }));
      await expect(
        service.setStatus(VEHICLE_ID, C1, 'FUERA_DE_USO'),
      ).resolves.toMatchObject({
        estado: 'FUERA_DE_USO',
      });
      expect(repo.update).toHaveBeenCalledWith(VEHICLE_ID, C1, {
        estado: 'FUERA_DE_USO',
      });
    });

    it('buche inexistente → 404', async () => {
      repo.update.mockResolvedValue(null);
      await expect(
        service.setStatus(VEHICLE_ID, C1, 'OPERATIVO'),
      ).rejects.toThrow(NotFoundException);
    });

    it('móvil dado de baja → 409', async () => {
      vehicles.findById.mockResolvedValue(
        vehicle({ estado: 'BAJA_DEFINITIVA' }),
      );
      await expect(
        service.setStatus(VEHICLE_ID, C1, 'OPERATIVO'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('elimina el buche', async () => {
      repo.findById.mockResolvedValue(compartment());
      repo.delete.mockResolvedValue(true);
      await expect(service.remove(VEHICLE_ID, C1)).resolves.toBeUndefined();
    });

    it('con materiales asignados → 409 con el nombre (criterio 3)', async () => {
      repo.findById.mockResolvedValue(compartment({ nombre: 'LC-2' }));
      repo.delete.mockRejectedValue(new CompartmentInUseError());
      const { status, body } = await errorBody(service.remove(VEHICLE_ID, C1));
      expect(status).toBe(409);
      expect(body).toMatchObject({
        code: 'COMPARTIMENTO_CON_MATERIALES',
        message: expect.stringContaining(
          'No se puede eliminar LC-2: tiene materiales asignados',
        ),
      });
    });

    it('inexistente → 404', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove(VEHICLE_ID, C1)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});

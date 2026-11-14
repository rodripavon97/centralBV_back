import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fieldError } from '../common/utils/field-error.js';
import {
  EMERGENCY_VEHICLE_REPOSITORY,
  type EmergencyVehicleRepository,
} from './domain/emergency-vehicle.repository.js';
import type { EmergencyVehicle } from './domain/emergency-vehicle.entity.js';
import {
  COMPARTMENT_REPOSITORY,
  CompartmentInUseError,
  type CompartmentChanges,
  type CompartmentRepository,
} from './domain/compartment.repository.js';
import type { Compartment } from './domain/compartment.entity.js';
import {
  COMPARTMENT_ERROR_CODES,
  type CompartmentStatus,
} from './domain/compartment.enums.js';
import {
  nextOrderInZone,
  normalizeCompartmentName,
  planCompartments,
  sameCompartmentName,
} from './domain/compartment-plan.js';
import { DUPLICATE_NAME_MESSAGE } from './repositories/supabase-compartment.repository.js';
import { GenerateCompartmentsDto } from './dtos/generate-compartments.dto.js';
import { CreateCompartmentDto } from './dtos/create-compartment.dto.js';
import { UpdateCompartmentDto } from './dtos/update-compartment.dto.js';

const VEHICLE_NOT_FOUND = 'El vehículo de emergencia no existe';
const WRITTEN_OFF = 'El vehículo está dado de baja definitiva';
const NOT_FOUND = 'El buche no existe';
const ALREADY_GENERATED =
  'Este móvil ya tiene buches. Agregá o editá los que necesites desde Editar buches.';
const NOTHING_TO_GENERATE = 'Elegí al menos un buche para generar';
const NOTHING_TO_UPDATE = 'Indicá el nombre o la zona del buche';

/**
 * Compartments ("buches") of a vehicle (US17). Configuring them (generate,
 * create, edit, delete) is for AUTOMOTORES; reading and changing a
 * compartment's status is for any signed-in user. Order inside each zone is
 * automatic. A compartment's status never changes the vehicle status.
 */
@Injectable()
export class CompartmentService {
  constructor(
    @Inject(EMERGENCY_VEHICLE_REPOSITORY)
    private readonly vehicles: EmergencyVehicleRepository,
    @Inject(COMPARTMENT_REPOSITORY)
    private readonly compartments: CompartmentRepository,
  ) {}

  /** The vehicle's compartments in plan order (404 if the vehicle is missing). */
  async list(vehiculoId: string): Promise<Compartment[]> {
    await this.vehicleOr404(vehiculoId);
    return this.compartments.findByVehicleId(vehiculoId);
  }

  /** Creates every compartment at once from per-zone counts; only for a vehicle with none. */
  async generate(
    vehiculoId: string,
    dto: GenerateCompartmentsDto,
  ): Promise<Compartment[]> {
    await this.writableVehicle(vehiculoId);
    const drafts = planCompartments(dto);
    if (drafts.length === 0) throw new BadRequestException(NOTHING_TO_GENERATE);

    const existing = await this.compartments.findByVehicleId(vehiculoId);
    if (existing.length > 0) {
      throw new ConflictException({
        message: ALREADY_GENERATED,
        code: COMPARTMENT_ERROR_CODES.alreadyGenerated,
      });
    }
    return this.compartments.createMany(vehiculoId, drafts);
  }

  /** Adds one compartment at the end of its zone. */
  async create(
    vehiculoId: string,
    dto: CreateCompartmentDto,
  ): Promise<Compartment> {
    await this.writableVehicle(vehiculoId);
    const nombre = normalizeCompartmentName(dto.nombre);
    const existing = await this.compartments.findByVehicleId(vehiculoId);
    this.assertFreeName(existing, nombre);

    const [created] = await this.compartments.createMany(vehiculoId, [
      { zona: dto.zona, nombre, orden: nextOrderInZone(existing, dto.zona) },
    ]);
    return created;
  }

  /** Renames a compartment or moves it to another zone (at its end). */
  async update(
    vehiculoId: string,
    id: string,
    dto: UpdateCompartmentDto,
  ): Promise<Compartment> {
    if (dto.nombre === undefined && dto.zona === undefined) {
      throw new BadRequestException(NOTHING_TO_UPDATE);
    }
    await this.writableVehicle(vehiculoId);
    const existing = await this.compartments.findByVehicleId(vehiculoId);
    const current = existing.find((c) => c.id === id);
    if (!current) throw new NotFoundException(NOT_FOUND);

    const changes: CompartmentChanges = {};
    if (dto.nombre !== undefined) {
      const nombre = normalizeCompartmentName(dto.nombre);
      this.assertFreeName(
        existing.filter((c) => c.id !== id),
        nombre,
      );
      if (nombre !== current.nombre) changes.nombre = nombre;
    }
    if (dto.zona !== undefined && dto.zona !== current.zona) {
      changes.zona = dto.zona;
      changes.orden = nextOrderInZone(existing, dto.zona);
    }
    if (Object.keys(changes).length === 0) return current;

    const updated = await this.compartments.update(vehiculoId, id, changes);
    if (!updated) throw new NotFoundException(NOT_FOUND);
    return updated;
  }

  /** Changes a compartment's status (any signed-in user). Leaves the vehicle status alone. */
  async setStatus(
    vehiculoId: string,
    id: string,
    estado: CompartmentStatus,
  ): Promise<Compartment> {
    await this.writableVehicle(vehiculoId);
    const updated = await this.compartments.update(vehiculoId, id, { estado });
    if (!updated) throw new NotFoundException(NOT_FOUND);
    return updated;
  }

  /** Deletes a compartment; refused while it has materials (once they exist). */
  async remove(vehiculoId: string, id: string): Promise<void> {
    await this.writableVehicle(vehiculoId);
    const current = await this.compartments.findById(vehiculoId, id);
    if (!current) throw new NotFoundException(NOT_FOUND);
    try {
      const deleted = await this.compartments.delete(vehiculoId, id);
      if (!deleted) throw new NotFoundException(NOT_FOUND);
    } catch (error) {
      if (error instanceof CompartmentInUseError) {
        throw new ConflictException({
          message: `No se puede eliminar ${current.nombre}: tiene materiales asignados. Pasalos a otro buche o quitalos primero.`,
          code: COMPARTMENT_ERROR_CODES.hasMaterials,
        });
      }
      throw error;
    }
  }

  private assertFreeName(others: Compartment[], nombre: string): void {
    if (others.some((c) => sameCompartmentName(c.nombre, nombre))) {
      throw new ConflictException(
        fieldError(
          'nombre',
          COMPARTMENT_ERROR_CODES.duplicateName,
          DUPLICATE_NAME_MESSAGE,
        ),
      );
    }
  }

  private async vehicleOr404(vehiculoId: string): Promise<EmergencyVehicle> {
    const vehicle = await this.vehicles.findById(vehiculoId);
    if (!vehicle) throw new NotFoundException(VEHICLE_NOT_FOUND);
    return vehicle;
  }

  /** Writes are refused on a written-off vehicle; reads still work. */
  private async writableVehicle(vehiculoId: string): Promise<EmergencyVehicle> {
    const vehicle = await this.vehicleOr404(vehiculoId);
    if (vehicle.estado === 'BAJA_DEFINITIVA') {
      throw new ConflictException(WRITTEN_OFF);
    }
    return vehicle;
  }
}

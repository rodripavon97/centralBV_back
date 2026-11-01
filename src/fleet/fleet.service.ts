import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildPaginatedResponse } from '../common/utils/pagination.utils.js';
import {
  EMERGENCY_VEHICLE_REPOSITORY,
  type EmergencyVehicleData,
  type EmergencyVehicleRepository,
} from './domain/emergency-vehicle.repository.js';
import {
  VEHICLE_CATALOG_REPOSITORY,
  type VehicleCatalogRepository,
} from './domain/vehicle-catalog.repository.js';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from './domain/revision.repository.js';
import type { EmergencyVehicle } from './domain/emergency-vehicle.entity.js';
import type { Revision, RevisionItems } from './domain/revision.entity.js';
import type { FleetSummary } from './domain/emergency-vehicle.enums.js';
import { estadoDesdeRevision } from './domain/revision-status.js';
import { REVISION_ITEM_KEYS } from './domain/revision.enums.js';
import {
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_MIN_LENGTH,
  detectLicensePlateFormat,
  normalizeLicensePlate,
} from './domain/license-plate.js';
import {
  denominationKey,
  normalizeDenomination,
} from './domain/denomination.js';
import { fieldError } from '../common/utils/field-error.js';
import { CreateEmergencyVehicleDto } from './dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from './dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from './dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from './dtos/write-off-emergency-vehicle.dto.js';
import { CreateRevisionDto } from './dtos/create-revision.dto.js';

const NOT_FOUND = 'El vehículo de emergencia no existe';
const REVISION_NOT_FOUND = 'El vehículo no tiene revisiones';
const ALREADY_WRITTEN_OFF = 'El vehículo ya está dado de baja definitiva';
const IN_MAINTENANCE = 'No se puede revisar un vehículo en mantenimiento';
const INVALID_CATALOG = 'El tipo, marca o modelo no es válido o no está activo';
const MODEL_BRAND_MISMATCH = 'El modelo no pertenece a la marca indicada';

/** Códigos que el front usa para ubicar el error o pedir confirmación. */
export const FLEET_ERROR_CODES = {
  plateRequired: 'PATENTE_OBLIGATORIA',
  plateLength: 'PATENTE_LARGO_INVALIDO',
  plateUnknownFormat: 'PATENTE_FORMATO_DESCONOCIDO',
  plateDuplicate: 'PATENTE_DUPLICADA',
  denominationRequired: 'DENOMINACION_OBLIGATORIA',
  denominationDuplicate: 'DENOMINACION_DUPLICADA',
} as const;

const plateRequired = () =>
  new BadRequestException(
    fieldError(
      'patente',
      FLEET_ERROR_CODES.plateRequired,
      'La patente es obligatoria',
    ),
  );

/** Application rules for emergency vehicle lifecycle. */
@Injectable()
export class FleetService {
  constructor(
    @Inject(EMERGENCY_VEHICLE_REPOSITORY)
    private readonly vehicles: EmergencyVehicleRepository,
    @Inject(VEHICLE_CATALOG_REPOSITORY)
    private readonly catalog: VehicleCatalogRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisions: RevisionRepository,
  ) {}

  /** Lists active vehicles (excludes BAJA_DEFINITIVA) with search, filters and pagination. */
  async findAll(query: ListEmergencyVehiclesDto) {
    const { busqueda, estado, tipoId, ordenPor, orden, pagina, porPagina } =
      query;
    const { items, total } = await this.vehicles.findAll({
      busqueda: busqueda?.trim() || undefined,
      estado,
      tipoId,
      ordenPor,
      orden,
      pagina,
      porPagina,
    });
    return buildPaginatedResponse(items, total, pagina, porPagina);
  }

  /** Active vehicles by status, for the dashboard counters (US05). */
  async summary(): Promise<FleetSummary> {
    return this.vehicles.countByStatus();
  }

  /** Returns the vehicle or throws if it does not exist. */
  async findById(id: string): Promise<EmergencyVehicle> {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundException(NOT_FOUND);
    return vehicle;
  }

  /** Creates a vehicle in OPERATIVO status. */
  async create(dto: CreateEmergencyVehicleDto): Promise<EmergencyVehicle> {
    const data = await this.toValidatedData(dto, null);
    return this.vehicles.create(data);
  }

  /** Updates general data; rejects written-off vehicles. */
  async update(
    id: string,
    dto: UpdateEmergencyVehicleDto,
  ): Promise<EmergencyVehicle> {
    const existing = await this.vehicles.findById(id);
    if (!existing) throw new NotFoundException(NOT_FOUND);
    if (existing.estado === 'BAJA_DEFINITIVA') {
      throw new ConflictException(ALREADY_WRITTEN_OFF);
    }
    const data = await this.toValidatedData(dto, existing);
    const updated = await this.vehicles.update(id, data);
    if (!updated) throw new ConflictException(ALREADY_WRITTEN_OFF);
    return updated;
  }

  /** Permanently writes off a vehicle with a required reason. */
  async writeOff(
    id: string,
    dto: WriteOffEmergencyVehicleDto,
  ): Promise<EmergencyVehicle> {
    const existing = await this.vehicles.findById(id);
    if (!existing) throw new NotFoundException(NOT_FOUND);
    if (existing.estado === 'BAJA_DEFINITIVA') {
      throw new ConflictException(ALREADY_WRITTEN_OFF);
    }
    const writtenOff = await this.vehicles.markAsWrittenOff(id, dto.motivo);
    if (!writtenOff) throw new ConflictException(ALREADY_WRITTEN_OFF);
    return writtenOff;
  }

  /**
   * Registers a checklist inspection and updates the vehicle status
   * (OPERATIVO / OBSERVACIONES / FUERA_SERVICIO). Blocked for
   * BAJA_DEFINITIVA and MANTENIMIENTO.
   */
  async createRevision(
    vehiculoId: string,
    dto: CreateRevisionDto,
  ): Promise<Revision> {
    const vehicle = await this.vehicles.findById(vehiculoId);
    if (!vehicle) throw new NotFoundException(NOT_FOUND);
    if (vehicle.estado === 'BAJA_DEFINITIVA') {
      throw new ConflictException(ALREADY_WRITTEN_OFF);
    }
    if (vehicle.estado === 'MANTENIMIENTO') {
      throw new ConflictException(IN_MAINTENANCE);
    }

    const items = this.toRevisionItems(dto);
    const nuevoEstado = estadoDesdeRevision(items);
    const revision = await this.revisions.create({
      vehiculoId,
      items,
      comentarioGeneral: dto.comentarioGeneral ?? null,
    });
    const updated = await this.vehicles.updateStatus(vehiculoId, nuevoEstado);
    if (!updated) {
      throw new ConflictException('Error al actualizar el estado del vehículo');
    }
    return revision;
  }

  /** Latest inspection for a vehicle, or 404 if none / vehicle missing. */
  async findLatestRevision(vehiculoId: string): Promise<Revision> {
    const vehicle = await this.vehicles.findById(vehiculoId);
    if (!vehicle) throw new NotFoundException(NOT_FOUND);
    const revision = await this.revisions.findLatestByVehicleId(vehiculoId);
    if (!revision) throw new NotFoundException(REVISION_NOT_FOUND);
    return revision;
  }

  private toRevisionItems(dto: CreateRevisionDto): RevisionItems {
    const items = {} as RevisionItems;
    for (const key of REVISION_ITEM_KEYS) {
      const item = dto[key];
      items[key] = {
        estado: item.estado,
        comentario: item.estado === 'OK' ? null : (item.comentario ?? null),
      };
    }
    return items;
  }

  /**
   * Normaliza patente y denominación, valida formato y duplicados, y que
   * tipo/marca/modelo existan y estén activos. `existing` es el vehículo que
   * se edita (null en el alta): no choca consigo mismo y, si la patente no
   * cambió, no vuelve a pedir confirmación de formato especial.
   */
  private async toValidatedData(
    dto: CreateEmergencyVehicleDto | UpdateEmergencyVehicleDto,
    existing: EmergencyVehicle | null,
  ): Promise<EmergencyVehicleData> {
    const denominacion = normalizeDenomination(dto.denominacion);
    if (!denominacion) {
      throw new BadRequestException(
        fieldError(
          'denominacion',
          FLEET_ERROR_CODES.denominationRequired,
          'La denominación es obligatoria',
        ),
      );
    }
    const patente = this.toCanonicalPlate(dto, existing);

    const [plateOwner, denominationOwner] = await Promise.all([
      this.vehicles.findIdByPatente(patente),
      this.vehicles.findActiveIdByDenominationKey(
        denominationKey(denominacion),
      ),
    ]);
    if (plateOwner && plateOwner !== existing?.id) {
      throw new ConflictException(
        fieldError(
          'patente',
          FLEET_ERROR_CODES.plateDuplicate,
          'Ya existe un móvil con esa patente',
        ),
      );
    }
    if (denominationOwner && denominationOwner !== existing?.id) {
      throw new ConflictException(
        fieldError(
          'denominacion',
          FLEET_ERROR_CODES.denominationDuplicate,
          'Ya existe un móvil con esa denominación',
        ),
      );
    }

    const [types, brands, models] = await Promise.all([
      this.catalog.findTypes(),
      this.catalog.findBrands(),
      this.catalog.findModels(),
    ]);

    const tipo = types.find((t) => t.id === dto.tipoId);
    const marca = brands.find((b) => b.id === dto.marcaId);
    const modelo = models.find((m) => m.id === dto.modeloId);
    if (!tipo || !marca || !modelo) {
      throw new BadRequestException(INVALID_CATALOG);
    }
    if (modelo.marcaId !== dto.marcaId) {
      throw new BadRequestException(MODEL_BRAND_MISMATCH);
    }

    return {
      patente,
      denominacion,
      tipoId: dto.tipoId,
      marcaId: dto.marcaId,
      modeloId: dto.modeloId,
    };
  }

  /**
   * Patente canónica ("ab 123-cd" → "AB123CD"). Un formato desconocido
   * necesita `confirmarPatenteEspecial: true`, salvo que sea la misma
   * patente que el vehículo ya tenía.
   */
  private toCanonicalPlate(
    dto: CreateEmergencyVehicleDto | UpdateEmergencyVehicleDto,
    existing: EmergencyVehicle | null,
  ): string {
    const patente = normalizeLicensePlate(dto.patente);
    if (!patente) throw plateRequired();
    if (
      patente.length < LICENSE_PLATE_MIN_LENGTH ||
      patente.length > LICENSE_PLATE_MAX_LENGTH
    ) {
      throw new BadRequestException(
        fieldError(
          'patente',
          FLEET_ERROR_CODES.plateLength,
          `La patente debe tener entre ${LICENSE_PLATE_MIN_LENGTH} y ${LICENSE_PLATE_MAX_LENGTH} letras o números`,
        ),
      );
    }
    const unchanged = existing?.patente === patente;
    if (
      !detectLicensePlateFormat(patente) &&
      !unchanged &&
      dto.confirmarPatenteEspecial !== true
    ) {
      throw new BadRequestException(
        fieldError(
          'patente',
          FLEET_ERROR_CODES.plateUnknownFormat,
          'La patente no coincide con ningún formato argentino conocido. Si es un caso especial, confirmá para guardarla igual.',
        ),
      );
    }
    return patente;
  }
}

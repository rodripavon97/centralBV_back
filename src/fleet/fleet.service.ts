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
import type { EmergencyVehicle } from './domain/emergency-vehicle.entity.js';
import { CreateEmergencyVehicleDto } from './dtos/create-emergency-vehicle.dto.js';
import { UpdateEmergencyVehicleDto } from './dtos/update-emergency-vehicle.dto.js';
import { ListEmergencyVehiclesDto } from './dtos/list-emergency-vehicles.dto.js';
import { WriteOffEmergencyVehicleDto } from './dtos/write-off-emergency-vehicle.dto.js';

const NOT_FOUND = 'El vehículo de emergencia no existe';
const ALREADY_WRITTEN_OFF =
  'El vehículo ya está dado de baja definitiva';
const INVALID_CATALOG =
  'El tipo, marca o modelo no es válido o no está activo';
const MODEL_BRAND_MISMATCH =
  'El modelo no pertenece a la marca indicada';

/** Application rules for emergency vehicle lifecycle. */
@Injectable()
export class FleetService {
  constructor(
    @Inject(EMERGENCY_VEHICLE_REPOSITORY)
    private readonly vehicles: EmergencyVehicleRepository,
    @Inject(VEHICLE_CATALOG_REPOSITORY)
    private readonly catalog: VehicleCatalogRepository,
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

  /** Returns the vehicle or throws if it does not exist. */
  async findById(id: string): Promise<EmergencyVehicle> {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundException(NOT_FOUND);
    return vehicle;
  }

  /** Creates a vehicle in OPERATIVO status. */
  async create(dto: CreateEmergencyVehicleDto): Promise<EmergencyVehicle> {
    const data = await this.toValidatedData(dto);
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
    const data = await this.toValidatedData(dto);
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

  private async toValidatedData(
    dto: CreateEmergencyVehicleDto | UpdateEmergencyVehicleDto,
  ): Promise<EmergencyVehicleData> {
    const patente = dto.patente.trim();
    const denominacion = dto.denominacion.trim();
    if (!patente || !denominacion) {
      throw new BadRequestException(
        'La patente y la denominación no pueden estar vacías',
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
}

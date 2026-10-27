import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  VEHICLE_CATALOG_REPOSITORY,
  type VehicleCatalogRepository,
} from './domain/vehicle-catalog.repository.js';
import {
  EMERGENCY_VEHICLE_REPOSITORY,
  type EmergencyVehicleRepository,
} from './domain/emergency-vehicle.repository.js';
import type {
  EmergencyVehicleBrand,
  EmergencyVehicleModel,
  EmergencyVehicleType,
} from './domain/vehicle-catalog.entity.js';

const EMPTY_NAME = 'El nombre no puede estar vacío';
const TYPE_IN_USE =
  'No se puede desactivar el tipo mientras haya vehículos de emergencia asociados';
const BRAND_IN_USE =
  'No se puede desactivar la marca mientras haya vehículos de emergencia asociados';
const MODEL_IN_USE =
  'No se puede desactivar el modelo mientras haya vehículos de emergencia asociados';

/** Application rules for vehicle type, brand and model catalogs. */
@Injectable()
export class VehicleCatalogService {
  constructor(
    @Inject(VEHICLE_CATALOG_REPOSITORY)
    private readonly catalog: VehicleCatalogRepository,
    @Inject(EMERGENCY_VEHICLE_REPOSITORY)
    private readonly vehicles: EmergencyVehicleRepository,
  ) {}

  private requireName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException(EMPTY_NAME);
    return trimmed;
  }

  async findTypes(): Promise<EmergencyVehicleType[]> {
    return this.catalog.findTypes();
  }

  async createType(name: string): Promise<EmergencyVehicleType> {
    return this.catalog.createType(this.requireName(name));
  }

  async updateType(id: string, name: string): Promise<EmergencyVehicleType> {
    return this.catalog.updateType(id, this.requireName(name));
  }

  async deactivateType(id: string): Promise<void> {
    if (await this.vehicles.existsByType(id)) {
      throw new ConflictException(TYPE_IN_USE);
    }
    await this.catalog.deactivateType(id);
  }

  async findBrands(): Promise<EmergencyVehicleBrand[]> {
    return this.catalog.findBrands();
  }

  async createBrand(name: string): Promise<EmergencyVehicleBrand> {
    return this.catalog.createBrand(this.requireName(name));
  }

  async updateBrand(id: string, name: string): Promise<EmergencyVehicleBrand> {
    return this.catalog.updateBrand(id, this.requireName(name));
  }

  async deactivateBrand(id: string): Promise<void> {
    if (await this.vehicles.existsByBrand(id)) {
      throw new ConflictException(BRAND_IN_USE);
    }
    await this.catalog.deactivateBrand(id);
  }

  async findModels(): Promise<EmergencyVehicleModel[]> {
    return this.catalog.findModels();
  }

  async createModel(
    name: string,
    brandId: string,
  ): Promise<EmergencyVehicleModel> {
    return this.catalog.createModel(this.requireName(name), brandId);
  }

  async updateModel(id: string, name: string): Promise<EmergencyVehicleModel> {
    return this.catalog.updateModel(id, this.requireName(name));
  }

  async deactivateModel(id: string): Promise<void> {
    if (await this.vehicles.existsByModel(id)) {
      throw new ConflictException(MODEL_IN_USE);
    }
    await this.catalog.deactivateModel(id);
  }
}

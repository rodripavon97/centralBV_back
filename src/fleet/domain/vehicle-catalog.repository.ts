import {
  EmergencyVehicleBrand,
  EmergencyVehicleModel,
  EmergencyVehicleType,
} from './vehicle-catalog.entity.js';

export interface VehicleCatalogRepository {
  findTypes(): Promise<EmergencyVehicleType[]>;
  createType(name: string): Promise<EmergencyVehicleType>;
  updateType(id: string, name: string): Promise<EmergencyVehicleType>;
  deactivateType(id: string): Promise<void>;

  findBrands(): Promise<EmergencyVehicleBrand[]>;
  createBrand(name: string): Promise<EmergencyVehicleBrand>;
  updateBrand(id: string, name: string): Promise<EmergencyVehicleBrand>;
  deactivateBrand(id: string): Promise<void>;

  findModels(): Promise<EmergencyVehicleModel[]>;
  createModel(name: string, brandId: string): Promise<EmergencyVehicleModel>;
  updateModel(id: string, name: string): Promise<EmergencyVehicleModel>;
  deactivateModel(id: string): Promise<void>;
}

export const VEHICLE_CATALOG_REPOSITORY = 'VEHICLE_CATALOG_REPOSITORY';

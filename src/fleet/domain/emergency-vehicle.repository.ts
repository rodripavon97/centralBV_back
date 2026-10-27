import type { EmergencyVehicle } from './emergency-vehicle.entity.js';
import type { ActiveVehicleStatus } from './emergency-vehicle.enums.js';

/** Filters and pagination for the active vehicle list (excludes BAJA_DEFINITIVA). */
export interface EmergencyVehicleFilter {
  busqueda?: string;
  estado?: ActiveVehicleStatus;
  tipoId?: string;
  ordenPor: 'denominacion' | 'patente';
  orden: 'asc' | 'desc';
  pagina: number;
  porPagina: number;
}

/** General vehicle data (no status). Used on create and update. */
export interface EmergencyVehicleData {
  patente: string;
  denominacion: string;
  tipoId: string;
  marcaId: string;
  modeloId: string;
}

/**
 * Persistence port for emergency vehicles.
 * Conditional updates return null when preconditions are not met.
 */
export interface EmergencyVehicleRepository {
  findAll(
    filter: EmergencyVehicleFilter,
  ): Promise<{ items: EmergencyVehicle[]; total: number }>;
  findById(id: string): Promise<EmergencyVehicle | null>;
  create(data: EmergencyVehicleData): Promise<EmergencyVehicle>;
  /** Returns null if missing or already BAJA_DEFINITIVA. */
  update(
    id: string,
    data: EmergencyVehicleData,
  ): Promise<EmergencyVehicle | null>;
  /** Returns null if missing or already BAJA_DEFINITIVA. */
  markAsWrittenOff(
    id: string,
    motivo: string,
  ): Promise<EmergencyVehicle | null>;
  existsByType(typeId: string): Promise<boolean>;
  existsByBrand(brandId: string): Promise<boolean>;
  existsByModel(modelId: string): Promise<boolean>;
}

export const EMERGENCY_VEHICLE_REPOSITORY = 'EMERGENCY_VEHICLE_REPOSITORY';

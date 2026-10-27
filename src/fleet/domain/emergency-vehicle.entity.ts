import { EmergencyVehicleStatus } from './emergency-vehicle.enums.js';
import type {
  EmergencyVehicleBrand,
  EmergencyVehicleModel,
  EmergencyVehicleType,
} from './vehicle-catalog.entity.js';

/** Emergency vehicle of the fleet, with embedded catalog entries. */
export interface EmergencyVehicle {
  id: string;
  estado: EmergencyVehicleStatus;
  patente: string;
  denominacion: string;
  tipo: EmergencyVehicleType;
  marca: EmergencyVehicleBrand;
  modelo: EmergencyVehicleModel;
  /** Set when estado is BAJA_DEFINITIVA; otherwise null. */
  motivoBaja: string | null;
}

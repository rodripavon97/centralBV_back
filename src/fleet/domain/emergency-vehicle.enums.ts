export const EMERGENCY_VEHICLE_STATUS = [
  'OPERATIVO',
  'MANTENIMIENTO',
  'OBSERVACIONES',
  'FUERA_SERVICIO',
  'BAJA_DEFINITIVA',
] as const;

export type EmergencyVehicleStatus = (typeof EMERGENCY_VEHICLE_STATUS)[number];

/** Statuses allowed on the active vehicle list (excludes BAJA_DEFINITIVA). */
export const ACTIVE_VEHICLE_STATUSES = [
  'OPERATIVO',
  'MANTENIMIENTO',
  'OBSERVACIONES',
  'FUERA_SERVICIO',
] as const;

export type ActiveVehicleStatus = (typeof ACTIVE_VEHICLE_STATUSES)[number];

/** Cantidad de móviles activos por estado (para el dashboard de flota). */
export interface FleetSummary {
  total: number;
  porEstado: Record<ActiveVehicleStatus, number>;
}

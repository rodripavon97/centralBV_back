import type {
  CompartmentStatus,
  CompartmentZone,
} from './compartment.enums.js';

/** A compartment ("buche") of an emergency vehicle. */
export interface Compartment {
  id: string;
  vehiculoId: string;
  zona: CompartmentZone;
  nombre: string;
  /** Position inside its zone, starting at 1 (set by the backend). */
  orden: number;
  estado: CompartmentStatus;
  creadoEn: string;
  actualizadoEn: string;
}

/** What is needed to create a compartment. */
export interface CompartmentDraft {
  zona: CompartmentZone;
  nombre: string;
  orden: number;
}

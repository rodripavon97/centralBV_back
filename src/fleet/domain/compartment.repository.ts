import type { Compartment, CompartmentDraft } from './compartment.entity.js';
import type {
  CompartmentStatus,
  CompartmentZone,
} from './compartment.enums.js';

/** Fields that can change on an existing compartment. */
export interface CompartmentChanges {
  nombre?: string;
  zona?: CompartmentZone;
  orden?: number;
  estado?: CompartmentStatus;
}

/**
 * Persistence port for vehicle compartments ("buches").
 * Duplicate names surface as 409 on `nombre`; deleting a compartment that
 * something still references (materials, later) surfaces as 409.
 */
export interface CompartmentRepository {
  /** Compartments of a vehicle in plan order (zone, then position). */
  findByVehicleId(vehiculoId: string): Promise<Compartment[]>;
  /** One compartment of that vehicle, or null if missing or of another vehicle. */
  findById(vehiculoId: string, id: string): Promise<Compartment | null>;
  createMany(
    vehiculoId: string,
    drafts: CompartmentDraft[],
  ): Promise<Compartment[]>;
  update(
    vehiculoId: string,
    id: string,
    changes: CompartmentChanges,
  ): Promise<Compartment | null>;
  /** false if there was nothing to delete. */
  delete(vehiculoId: string, id: string): Promise<boolean>;
}

export const COMPARTMENT_REPOSITORY = 'COMPARTMENT_REPOSITORY';

/** Thrown by `delete` when something still references the compartment (materials). */
export class CompartmentInUseError extends Error {
  constructor() {
    super('Compartment still referenced');
    this.name = 'CompartmentInUseError';
  }
}

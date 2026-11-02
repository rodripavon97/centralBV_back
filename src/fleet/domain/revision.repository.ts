import type { Revision, RevisionItems } from './revision.entity.js';
import type { EmergencyVehicleStatus } from './emergency-vehicle.enums.js';

/** Estado en que puede quedar un móvil después de una revisión. */
export type RevisionResultStatus = Extract<
  EmergencyVehicleStatus,
  'OPERATIVO' | 'OBSERVACIONES' | 'FUERA_SERVICIO'
>;

/** Datos para persistir una revisión (sin id ni timestamps). */
export interface RevisionData {
  vehiculoId: string;
  items: RevisionItems;
  comentarioGeneral: string | null;
  /** Usuario que la registra (del JWT); null si no se conoce. */
  revisadoPor: string | null;
  /** Estado nuevo del móvil, calculado con estadoDesdeRevision. */
  estadoNuevo: RevisionResultStatus;
}

/**
 * Persistence port for vehicle inspections (revisiones).
 */
export interface RevisionRepository {
  /**
   * Guarda la revisión y actualiza el estado del móvil en una sola transacción.
   * Lanza NotFound si el móvil no existe, Conflict si está dado de baja y
   * BadRequest si estaba en mantenimiento sin comentario general.
   */
  create(data: RevisionData): Promise<Revision>;
  findLatestByVehicleId(vehiculoId: string): Promise<Revision | null>;
  /** Revisiones del móvil, de la más nueva a la más vieja. */
  findByVehicleId(
    vehiculoId: string,
    pagina: number,
    porPagina: number,
  ): Promise<{ items: Revision[]; total: number }>;
  /** Una revisión de ese móvil, o null si no existe o es de otro móvil. */
  findById(vehiculoId: string, revisionId: string): Promise<Revision | null>;
}

export const REVISION_REPOSITORY = 'REVISION_REPOSITORY';

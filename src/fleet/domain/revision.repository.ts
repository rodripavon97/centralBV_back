import type { Revision, RevisionItems } from './revision.entity.js';

/** Datos para persistir una revisión (sin id ni timestamps). */
export interface RevisionData {
  vehiculoId: string;
  items: RevisionItems;
  comentarioGeneral: string | null;
}

/**
 * Persistence port for vehicle inspections (revisiones).
 */
export interface RevisionRepository {
  create(data: RevisionData): Promise<Revision>;
  findLatestByVehicleId(vehiculoId: string): Promise<Revision | null>;
}

export const REVISION_REPOSITORY = 'REVISION_REPOSITORY';

import type { ItemRevisionStatus, RevisionItemKey } from './revision.enums.js';

/** Un elemento chequeado en una revisión (estado + comentario). */
export interface ItemRevision {
  estado: ItemRevisionStatus;
  /** Obligatorio cuando estado es ADVERTENCIA o CRITICO; null si OK. */
  comentario: string | null;
}

/** Checklist completo de una revisión (7 ítems fijos). */
export type RevisionItems = Record<RevisionItemKey, ItemRevision>;

/** Quién registró la revisión. */
export interface RevisionAuthor {
  id: string;
  nombre: string;
}

/** Revisión de un vehículo de emergencia. */
export interface Revision {
  id: string;
  vehiculoId: string;
  nivelAceite: ItemRevision;
  frenos: ItemRevision;
  refrigerante: ItemRevision;
  bateria: ItemRevision;
  presionNeumaticos: ItemRevision;
  lucesYBalizas: ItemRevision;
  sirenaYComunicaciones: ItemRevision;
  comentarioGeneral: string | null;
  /** null en revisiones anteriores a que se guardara el autor, o si el usuario se borró. */
  revisadoPor: RevisionAuthor | null;
  creadoEn: string;
}

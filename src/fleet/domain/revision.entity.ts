import type {
  ItemRevisionStatus,
  RevisionItemKey,
} from './revision.enums.js';

/** Un elemento chequeado en una revisión (estado + comentario). */
export interface ItemRevision {
  estado: ItemRevisionStatus;
  /** Obligatorio cuando estado es ADVERTENCIA o CRITICO; null si OK. */
  comentario: string | null;
}

/** Checklist completo de una revisión (7 ítems fijos). */
export type RevisionItems = Record<RevisionItemKey, ItemRevision>;

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
  creadoEn: string;
}

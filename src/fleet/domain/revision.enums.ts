/** Estado de un ítem del checklist de revisión. */
export const ITEM_REVISION_STATUS = ['OK', 'ADVERTENCIA', 'CRITICO'] as const;

export type ItemRevisionStatus = (typeof ITEM_REVISION_STATUS)[number];

/** Claves fijas del checklist de revisión de un móvil. */
export const REVISION_ITEM_KEYS = [
  'nivelAceite',
  'frenos',
  'refrigerante',
  'bateria',
  'presionNeumaticos',
  'lucesYBalizas',
  'sirenaYComunicaciones',
] as const;

export type RevisionItemKey = (typeof REVISION_ITEM_KEYS)[number];

/** Códigos de error de revisiones que el front usa para ubicar el campo. */
export const REVISION_ERROR_CODES = {
  maintenanceCommentRequired: 'COMENTARIO_OBLIGATORIO',
} as const;

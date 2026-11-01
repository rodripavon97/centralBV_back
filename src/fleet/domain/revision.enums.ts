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

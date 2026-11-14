/** Zones of a vehicle where a compartment ("buche") sits (Figma · S5 Buches). */
export const COMPARTMENT_ZONES = [
  'LADO_CONDUCTOR',
  'LADO_ACOMPANANTE',
  'TRASERO',
  'TECHO',
  'CABINA',
] as const;

export type CompartmentZone = (typeof COMPARTMENT_ZONES)[number];

/** Name prefix for generated compartments: LC-1, LA-1, TR-1, TE-1, CB-1. */
export const ZONE_PREFIX: Record<CompartmentZone, string> = {
  LADO_CONDUCTOR: 'LC',
  LADO_ACOMPANANTE: 'LA',
  TRASERO: 'TR',
  TECHO: 'TE',
  CABINA: 'CB',
};

/**
 * Compartment status (the four of Figma · S5 Buches). Set by hand until
 * materials exist; it never changes the vehicle status.
 */
export const COMPARTMENT_STATUSES = [
  'OPERATIVO',
  'OBSERVACIONES',
  'DANADO',
  'FUERA_DE_USO',
] as const;

export type CompartmentStatus = (typeof COMPARTMENT_STATUSES)[number];

/** Limits of the generator (decided on 13/11). */
export const GENERATION_LIMITS = {
  side: 10,
  rear: 3,
} as const;

export const COMPARTMENT_NAME_MAX = 20;

/** Error codes the front uses to place errors on a field. */
export const COMPARTMENT_ERROR_CODES = {
  duplicateName: 'COMPARTIMENTO_DUPLICADO',
  alreadyGenerated: 'COMPARTIMENTOS_YA_GENERADOS',
  hasMaterials: 'COMPARTIMENTO_CON_MATERIALES',
} as const;

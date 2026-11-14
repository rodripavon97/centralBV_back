import type { Compartment, CompartmentDraft } from './compartment.entity.js';
import {
  COMPARTMENT_ZONES,
  ZONE_PREFIX,
  type CompartmentZone,
} from './compartment.enums.js';

/** How many compartments the generator creates in each zone. */
export interface GenerationCounts {
  ladoConductor: number;
  ladoAcompanante: number;
  trasero: number;
  techo: boolean;
  cabina: boolean;
}

/** "  lc   6 " → "LC 6": trimmed, single spaces, upper case. */
export function normalizeCompartmentName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Same name ignoring case (the database index uses lower(nombre)). */
export function sameCompartmentName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Compartments the generator creates, in plan order: LC-1…LC-n, LA-1…LA-n,
 * TR-1…TR-n, then TE-1 and CB-1 when they are on.
 */
export function planCompartments(counts: GenerationCounts): CompartmentDraft[] {
  const perZone: Record<CompartmentZone, number> = {
    LADO_CONDUCTOR: counts.ladoConductor,
    LADO_ACOMPANANTE: counts.ladoAcompanante,
    TRASERO: counts.trasero,
    TECHO: counts.techo ? 1 : 0,
    CABINA: counts.cabina ? 1 : 0,
  };
  return COMPARTMENT_ZONES.flatMap((zona) =>
    Array.from({ length: perZone[zona] }, (_, i) => ({
      zona,
      nombre: `${ZONE_PREFIX[zona]}-${i + 1}`,
      orden: i + 1,
    })),
  );
}

/** Next position at the end of a zone. */
export function nextOrderInZone(
  existing: Pick<Compartment, 'zona' | 'orden'>[],
  zona: CompartmentZone,
): number {
  return (
    existing
      .filter((c) => c.zona === zona)
      .reduce((max, c) => Math.max(max, c.orden), 0) + 1
  );
}

/** Plan order: by zone (as COMPARTMENT_ZONES lists them), then by position. */
export function sortCompartments<T extends Pick<Compartment, 'zona' | 'orden'>>(
  list: T[],
): T[] {
  const zoneIndex = (z: CompartmentZone) => COMPARTMENT_ZONES.indexOf(z);
  return [...list].sort(
    (a, b) => zoneIndex(a.zona) - zoneIndex(b.zona) || a.orden - b.orden,
  );
}

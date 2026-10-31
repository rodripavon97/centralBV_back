/**
 * Patentes argentinas.
 *
 * La forma canónica (la que se guarda) es solo mayúsculas y dígitos, sin
 * espacios ni guiones: "AB 123 CD" y "ab-123-cd" son la misma patente "AB123CD".
 * Para mostrarla se agrupa según el formato detectado.
 *
 * Si se cambian los patrones, actualizar también la columna generada
 * `patente_especial` en src/db/fleet.sql y `formatearPatente` del front.
 */

export const LICENSE_PLATE_FORMATS = [
  'MERCOSUR_AUTO',
  'AUTO_1995',
  'MERCOSUR_MOTO',
  'MOTO_1995',
  'PROVINCIAL',
] as const;

export type LicensePlateFormat = (typeof LICENSE_PLATE_FORMATS)[number];

interface FormatRule {
  format: LicensePlateFormat;
  pattern: RegExp;
  /** Largo de cada grupo al formatear; el último toma el resto. */
  groups: number[];
}

const RULES: FormatRule[] = [
  // AB 123 CD: autos desde 2016
  {
    format: 'MERCOSUR_AUTO',
    pattern: /^[A-Z]{2}\d{3}[A-Z]{2}$/,
    groups: [2, 3, 2],
  },
  // ABC 123: autos 1995–2016
  { format: 'AUTO_1995', pattern: /^[A-Z]{3}\d{3}$/, groups: [3, 3] },
  // A 123 BCD: motos desde 2016
  {
    format: 'MERCOSUR_MOTO',
    pattern: /^[A-Z]\d{3}[A-Z]{3}$/,
    groups: [1, 3, 3],
  },
  // 123 ABC: motos 1995–2016
  { format: 'MOTO_1995', pattern: /^\d{3}[A-Z]{3}$/, groups: [3, 3] },
  // B 1234567: provinciales anteriores a 1995 (letra de provincia + número)
  { format: 'PROVINCIAL', pattern: /^[A-Z]\d{4,7}$/, groups: [1, 7] },
];

/** Largo admitido de la forma canónica (también lo controla un CHECK en la base). */
export const LICENSE_PLATE_MIN_LENGTH = 2;
export const LICENSE_PLATE_MAX_LENGTH = 12;

/** Pasa a mayúsculas, quita acentos y deja solo letras y dígitos. */
export function normalizeLicensePlate(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Formato de una patente canónica, o null si no coincide con ninguno. */
export function detectLicensePlateFormat(
  canonical: string,
): LicensePlateFormat | null {
  return RULES.find((rule) => rule.pattern.test(canonical))?.format ?? null;
}

/** Patente lista para mostrar ("AB 123 CD"); si el formato es desconocido, sin cambios. */
export function formatLicensePlate(canonical: string): string {
  const rule = RULES.find((r) => r.pattern.test(canonical));
  if (!rule) return canonical;
  const parts: string[] = [];
  let start = 0;
  rule.groups.forEach((length, index) => {
    const end =
      index === rule.groups.length - 1 ? canonical.length : start + length;
    parts.push(canonical.slice(start, end));
    start = end;
  });
  return parts.filter(Boolean).join(' ');
}

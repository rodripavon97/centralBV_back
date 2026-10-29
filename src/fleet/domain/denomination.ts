/**
 * Denominación (número interno) de un móvil.
 *
 * En el cuartel de José C. Paz los móviles se llaman M-1, M-2, M-3…
 * Se guarda en mayúsculas y, si es letras + número (con o sin separador),
 * con un guion en el medio: "m1", "M 1" y "m-1" se guardan como "M-1".
 * Lo que no siga ese patrón queda en mayúsculas tal cual ("AB-04").
 *
 * Para detectar duplicados se compara la clave sin separadores
 * (`denominationKey`), así "M-1" y "M1" son el mismo móvil.
 * La misma clave la calcula la columna generada `denominacion_clave`
 * en src/db/fleet.sql; si cambia una, cambiar la otra.
 */

const LETTERS_AND_NUMBER = /^([A-Z]+)[\s._-]*(\d+)$/;

/** Mayúsculas, sin acentos ni espacios repetidos; letras+número → "M-1". */
export function normalizeDenomination(raw: string): string {
  const clean = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  const match = LETTERS_AND_NUMBER.exec(clean);
  return match ? `${match[1]}-${match[2]}` : clean;
}

/** Clave de comparación: solo letras y dígitos ("M-1" → "M1"). */
export function denominationKey(denomination: string): string {
  return normalizeDenomination(denomination).replace(/[^A-Z0-9]/g, '');
}

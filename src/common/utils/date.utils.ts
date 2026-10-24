const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Fecha y hora actual en Argentina con el formato "2026-10-22T09:15". */
export function ahoraEnArgentina(fecha = new Date()): string {
  // sv-SE formatea como "2026-10-22 09:15:00"
  return fecha
    .toLocaleString('sv-SE', { timeZone: TIME_ZONE })
    .replace(' ', 'T')
    .slice(0, 16);
}

/** true si "AAAA-MM-DDTHH:mm" es una fecha y hora que existe en el calendario. */
export function esFechaHoraValida(fechaHora: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(fechaHora);
  if (!m) return false;
  const [a, mes, d, h, min] = m.slice(1).map(Number);
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  return (
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === d &&
    h <= 23 &&
    min <= 59
  );
}

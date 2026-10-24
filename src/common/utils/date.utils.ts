const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Fecha y hora actual en Argentina. */
export function ahoraEnArgentina(fecha = new Date()): {
  fecha: string;
  hora: string;
} {
  // sv-SE formatea como "2026-10-22 09:15:00"
  const local = fecha
    .toLocaleString('sv-SE', { timeZone: TIME_ZONE })
    .replace(' ', 'T')
    .slice(0, 16);
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
}

/** true si fecha (AAAA-MM-DD) y hora (HH:mm) existen en el calendario. */
export function esFechaHoraValida(fecha: string, hora: string): boolean {
  const mFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const mHora = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!mFecha || !mHora) return false;
  const [a, mes, d] = mFecha.slice(1).map(Number);
  const [h, min] = mHora.slice(1).map(Number);
  const date = new Date(Date.UTC(a, mes - 1, d));
  return (
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === d &&
    h <= 23 &&
    min <= 59
  );
}

/** true si (fecha, hora) es estrictamente posterior a (refFecha, refHora). */
export function esPosteriorA(
  fecha: string,
  hora: string,
  refFecha: string,
  refHora: string,
): boolean {
  return `${fecha}T${hora}` > `${refFecha}T${refHora}`;
}

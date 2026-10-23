// Una solicitud es una fila de `constancias` antes (o después) de generar la
// constancia. El ciclo completo es PENDIENTE → REALIZADA → FIRMADA → RETIRADA,
// o PENDIENTE → CANCELADA. Ver src/db/constancias.sql.

export const TIPOS_SINIESTRO = ['VIVIENDA', 'VEHICULAR', 'ACCIDENTE_TRANSITO'] as const;
export type TipoSiniestro = (typeof TIPOS_SINIESTRO)[number];

export const ESTADOS_SOLICITUD = ['PENDIENTE', 'REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export interface Damnificado {
  nombre: string;
  apellido: string;
  dni: string; // solo dígitos
  telefono: string | null;
  domicilio: string | null;
}

export interface Siniestro {
  tipo: TipoSiniestro;
  fechaHora: string; // hora local de Argentina, "2026-10-11T18:20"
  lugar: string;
  descripcion: string;
}

export interface Solicitud {
  id: string;
  numero: string; // "SOL-0001"
  estado: EstadoSolicitud;
  fechaAlta: string; // ISO 8601
  damnificado: Damnificado;
  siniestro: Siniestro;
  motivoCancelacion: string | null;
  canceladoEn: string | null;
}

export interface DatosSolicitud {
  damnificado: Damnificado;
  siniestro: Siniestro;
}

export interface FiltroSolicitudes {
  busqueda?: string;
  estado?: EstadoSolicitud;
  orden: 'asc' | 'desc'; // por fecha de alta
  pagina: number; // empieza en 1
  porPagina: number;
}

/** Solo una solicitud pendiente se puede editar o cancelar (US13). */
export const esModificable = (s: Pick<Solicitud, 'estado'>) => s.estado === 'PENDIENTE';

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/** Fecha y hora actual en Argentina con el formato "2026-10-22T09:15". */
export function ahoraEnArgentina(fecha = new Date()): string {
  // sv-SE formatea como "2026-10-22 09:15:00"
  return fecha.toLocaleString('sv-SE', { timeZone: ZONA_HORARIA }).replace(' ', 'T').slice(0, 16);
}

/** true si "AAAA-MM-DDTHH:mm" es una fecha y hora que existe en el calendario. */
export function esFechaHoraValida(fechaHora: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(fechaHora);
  if (!m) return false;
  const [a, mes, d, h, min] = m.slice(1).map(Number);
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d && h <= 23 && min <= 59;
}

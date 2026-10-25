import type { CertificateRequest } from '../domain/certificate-request.entity.js';
import { ahoraEnArgentina } from '../../common/utils/date.utils.js';

const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const;

/** View model consumed by the PDF builder. */
export interface CertificatePdfViewModel {
  solicitante: string;
  dni: string;
  domicilio: string;
  localidad: string;
  partido: string;
  motivo: string;
  perdidas: string;
  presentado: string;
  parte: string;
  fechaDisplay: string;
  hora: string;
  /** Printed below fecha/hora when non-empty. */
  observaciones: string | null;
  dominio: string | null;
  poliza: string | null;
  footerDate: string;
  filename: string;
}

/** Formats DNI digits with thousand separators (e.g. 30.112.456). */
export function formatDni(dni: string): string {
  const trimmed = dni.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formats YYYY-MM-DD as DD/MM/YYYY. */
export function formatFechaDisplay(fecha: string): string {
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
}

/** Builds the emission line "JOSÉ C. PAZ, D DE MES DE YYYY." in Argentina time. */
export function formatFooterDate(now = new Date()): string {
  const { fecha } = ahoraEnArgentina(now);
  const [year, month, day] = fecha.split('-').map(Number);
  return `JOSÉ C. PAZ, ${day} DE ${MESES[month - 1]} DE ${year}.`;
}

/**
 * Maps a certificate request aggregate to the PDF view model.
 * @param observacionesOverride when provided (including null), replaces stored notes
 */
export function toCertificatePdfViewModel(
  request: CertificateRequest,
  now = new Date(),
  observacionesOverride?: string | null,
): CertificatePdfViewModel {
  const { damnificado: d, siniestro: s, constancia: c } = request;
  const fechaDisplay = formatFechaDisplay(s.fecha);
  const solicitante = d.nombre;
  const dominio =
    s.tipo === 'VEHICULAR' && s.patenteVehiculo ? s.patenteVehiculo : null;
  const poliza =
    c.destino === 'SEGURO' && c.numeroPoliza ? c.numeroPoliza : null;
  const observaciones =
    observacionesOverride !== undefined
      ? observacionesOverride
      : request.observaciones;
  const observacionesTexto =
    observaciones?.trim() ? observaciones.trim() : null;

  return {
    solicitante,
    dni: formatDni(d.dni),
    domicilio: s.direccion,
    localidad: s.localidad,
    partido: s.partido,
    motivo: s.motivo,
    perdidas: s.perdidas,
    presentado: c.razonSocial,
    parte: s.numeroParte,
    fechaDisplay,
    hora: s.hora,
    observaciones: observacionesTexto,
    dominio,
    poliza,
    footerDate: formatFooterDate(now),
    filename: `Constancia_${solicitante.replace(/\s+/g, '_')}_${fechaDisplay.replace(/\//g, '-')}.pdf`,
  };
}

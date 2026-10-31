import type { CertificateRequest } from '../domain/certificate-request.entity.js';
import { nowInArgentina } from '../../common/utils/date.utils.js';

const MONTHS = [
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
  applicant: string;
  dni: string;
  address: string;
  locality: string;
  district: string;
  reason: string;
  losses: string;
  presentedTo: string;
  reportNumber: string;
  dateDisplay: string;
  time: string;
  /** Printed below date/time when non-empty. */
  observations: string | null;
  vehiclePlate: string | null;
  policyNumber: string | null;
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
export function formatDateDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Builds the emission line "JOSÉ C. PAZ, D DE MES DE YYYY." in Argentina time. */
export function formatFooterDate(now = new Date()): string {
  const { date } = nowInArgentina(now);
  const [year, month, day] = date.split('-').map(Number);
  return `JOSÉ C. PAZ, ${day} DE ${MONTHS[month - 1]} DE ${year}.`;
}

/**
 * Maps a certificate request aggregate to the PDF view model.
 * @param observationsOverride when provided (including null), replaces stored notes
 */
export function toCertificatePdfViewModel(
  request: CertificateRequest,
  now = new Date(),
  observationsOverride?: string | null,
): CertificatePdfViewModel {
  const { damnificado: d, siniestro: s, constancia: c } = request;
  const dateDisplay = formatDateDisplay(s.fecha);
  const applicant = d.nombre;
  const vehiclePlate =
    s.tipo === 'VEHICULAR' && s.patenteVehiculo ? s.patenteVehiculo : null;
  const policyNumber =
    c.destino === 'SEGURO' && c.numeroPoliza ? c.numeroPoliza : null;
  const observations =
    observationsOverride !== undefined
      ? observationsOverride
      : request.observaciones;
  const observationsText = observations?.trim()
    ? observations.trim()
    : null;

  return {
    applicant,
    dni: formatDni(d.dni),
    address: s.direccion,
    locality: s.localidad,
    district: s.partido,
    reason: s.motivo,
    losses: s.perdidas,
    presentedTo: c.razonSocial,
    reportNumber: s.numeroParte,
    dateDisplay,
    time: s.hora,
    observations: observationsText,
    vehiclePlate,
    policyNumber,
    footerDate: formatFooterDate(now),
    filename: `Constancia_${applicant.replace(/\s+/g, '_')}_${dateDisplay.replace(/\//g, '-')}.pdf`,
  };
}

// A certificate request is a row in `constancias` before (or after) the
// certificate is generated. Full lifecycle: PENDIENTE → REALIZADA → FIRMADA → RETIRADA,
// or PENDIENTE → CANCELADA. See src/db/constancias.sql.

import {
  AccidentType,
  CertificateDestination,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
} from './certificate-request.enums.js';

/** Victim linked to the certificate request. */
export interface Victim {
  nombre: string;
  dni: string; // digits only
  telefono: string | null;
}

/** Accident / incident details for the request. */
export interface Accident {
  tipo: AccidentType;
  fecha: string; // YYYY-MM-DD (Argentina)
  hora: string; // HH:mm (Argentina)
  direccion: string;
  numeroParte: string;
  motivo: string;
  localidad: string;
  partido: string;
  perdidas: string;
  /** Required when tipo is VEHICULAR; otherwise null. */
  patenteVehiculo: string | null;
}

/** Certificate destination and policy fields filled at request creation. */
export interface Certificate {
  destino: CertificateDestination;
  /** Name of the insurer or social-action entity the certificate is presented to. */
  razonSocial: string;
  /** Required when destino is SEGURO; otherwise null. */
  numeroPoliza: string | null;
}

/** Fee payment (abono) recorded on the request; null when still PENDIENTE. */
export interface Payment {
  estado: PaymentStatus;
  monto: number | null;
  metodoPago: PaymentMethod | null;
  fechaPago: string;
  motivoExento: string | null;
}

/** Certificate request aggregate. */
export interface CertificateRequest {
  id: string;
  numero: string; // "SOL-0001"
  estado: RequestStatus;
  fechaAlta: string; // ISO 8601
  damnificado: Victim;
  siniestro: Accident;
  constancia: Certificate;
  abono: Payment | null;
  /** Notes captured when marking as REALIZADA; shown on the certificate PDF. */
  observaciones: string | null;

  motivoCancelacion: string | null;
  canceladoEn: string | null;
  retiradoEn: string | null;
  retiradoPorNombre: string | null;
  retiradoPorDni: string | null;
}

/** Only a pending request can be edited or cancelled (US13). */
export const isModifiable = (status: RequestStatus) => status === 'PENDIENTE';

/**
 * Valid lifecycle transitions:
 * - PENDIENTE → REALIZADA | CANCELADA
 * - REALIZADA → FIRMADA
 * - FIRMADA → RETIRADA
 * Staying in the same status is considered valid (idempotency).
 */
export const isStatusTransitionValid = (
  currentStatus: RequestStatus,
  newStatus: RequestStatus,
): boolean => {
  if (currentStatus === newStatus) return true;
  if (currentStatus === 'RETIRADA' || currentStatus === 'CANCELADA')
    return false;

  switch (currentStatus) {
    case 'PENDIENTE':
      return newStatus === 'REALIZADA' || newStatus === 'CANCELADA';
    case 'REALIZADA':
      return newStatus === 'FIRMADA';
    case 'FIRMADA':
      return newStatus === 'RETIRADA';
    default:
      return false;
  }
};

/** True if status can advance from current to next (real change + valid transition). */
export const canAdvanceTo = (
  currentStatus: RequestStatus,
  newStatus: RequestStatus,
): boolean =>
  currentStatus !== newStatus &&
  isStatusTransitionValid(currentStatus, newStatus);

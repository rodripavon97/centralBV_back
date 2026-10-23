// A certificate request is a row in `constancias` before (or after) the
// certificate is generated. Full lifecycle: PENDIENTE → REALIZADA → FIRMADA → RETIRADA,
// or PENDIENTE → CANCELADA. See src/db/constancias.sql.

import {
  AccidentType,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
} from './certificate-request.enums.js';

/** Victim (damnificado) linked to the certificate request. */
export interface Victim {
  nombre: string;
  apellido: string;
  dni: string; // digits only
  telefono: string | null;
  domicilio: string | null;
}

/** Accident / incident (siniestro) details for the request. */
export interface Accident {
  tipo: AccidentType;
  fechaHora: string; // Argentina time zone: YYYY-MM-DDTHH:mm
  lugar: string;
  descripcion: string;
}

/** Fee payment (abono) recorded on the request; null when still PENDIENTE. */
export interface Payment {
  estado: PaymentStatus;
  monto: number | null;
  metodoPago: PaymentMethod | null;
  fechaPago: string;
  motivoExento: string | null;
}

/** Certificate request aggregate as returned by the API and repository. */
export interface CertificateRequest {
  id: string;
  numero: string; // "SOL-0001"
  estado: RequestStatus;
  fechaAlta: string; // ISO 8601
  damnificado: Victim;
  siniestro: Accident;
  abono: Payment | null;

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

/** true if status can advance from current to next (real change + valid transition). */
export const canAdvanceTo = (
  currentStatus: RequestStatus,
  newStatus: RequestStatus,
): boolean =>
  currentStatus !== newStatus &&
  isStatusTransitionValid(currentStatus, newStatus);

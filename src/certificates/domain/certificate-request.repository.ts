import type {
  Accident,
  CertificateRequest,
  Payment,
  Victim,
} from './certificate-request.entity.js';
import { RequestStatus } from './certificate-request.enums.js';

/** Payload to create or update a request (victim + accident). */
export interface CertificateRequestData {
  damnificado: Victim;
  siniestro: Accident;
}

/** Filters and pagination for the request list (US09). */
export interface CertificateRequestFilter {
  busqueda?: string;
  estado?: RequestStatus;
  orden: 'asc' | 'desc'; // by fechaAlta
  pagina: number; // starts at 1
  porPagina: number;
}

/** Data of the person who picks up the certificate when marking as delivered. */
export interface DeliveryData {
  nombreCompleto: string;
  dni: string;
}

/**
 * Persistence port for certificate requests.
 * Conditional updates return null when preconditions are not met.
 */
export interface CertificateRequestRepository {
  findAll(
    filter: CertificateRequestFilter,
  ): Promise<{ items: CertificateRequest[]; total: number }>;
  findById(id: string): Promise<CertificateRequest | null>;

  create(
    data: CertificateRequestData,
    createdBy: string | null,
  ): Promise<CertificateRequest>;
  /** Returns null if the request is no longer pending. */
  updatePending(
    id: string,
    datos: CertificateRequestData,
  ): Promise<CertificateRequest | null>;
  /** Returns false if the request is not in REALIZADA. */
  signRequest(id: string): Promise<boolean>;
  /** Returns null if not FIRMADA or without payment (ABONADO/EXENTO). */
  markAsDelivered(
    id: string,
    data: DeliveryData,
  ): Promise<CertificateRequest | null>;
  /** Returns null if the request is no longer pending. */
  cancelPending(id: string, motivo: string): Promise<CertificateRequest | null>;
  /** Returns null if the request is cancelled or delivered (RETIRADA). */
  addPayment(id: string, payment: Payment): Promise<CertificateRequest | null>;
}

export const CERTIFICATE_REQUEST_REPOSITORY = 'CERTIFICATE_REQUEST_REPOSITORY';

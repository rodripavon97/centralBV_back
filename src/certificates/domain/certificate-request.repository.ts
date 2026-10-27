import type {
  Accident,
  Certificate,
  CertificateRequest,
  Payment,
  Victim,
} from './certificate-request.entity.js';
import { RequestStatus } from './certificate-request.enums.js';

/** Payload to create or update a request (victim + accident + certificate). */
export interface CertificateRequestData {
  damnificado: Victim;
  siniestro: Accident;
  constancia: Certificate;
}

/** Filters and pagination for the active request list (US09). Excludes RETIRADA. */
export interface CertificateRequestFilter {
  busqueda?: string;
  /** Optional status among active (non-RETIRADA) statuses. */
  estado?: RequestStatus;
  orden: 'asc' | 'desc'; // by fechaAlta
  pagina: number; // starts at 1
  porPagina: number;
}

/** Filters and pagination for the completed (RETIRADA) request list. */
export type CompletedCertificateRequestFilter = Omit<
  CertificateRequestFilter,
  'estado'
>;

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
  /**
   * Lists active requests (never includes RETIRADA).
   * Supports optional search, status filter, sort and pagination.
   */
  findAll(
    filter: CertificateRequestFilter,
  ): Promise<{ items: CertificateRequest[]; total: number }>;
  /**
   * Lists completed requests (only RETIRADA).
   * Supports search, sort and pagination (no status filter).
   */
  findCompleted(
    filter: CompletedCertificateRequestFilter,
  ): Promise<{ items: CertificateRequest[]; total: number }>;
  findById(id: string): Promise<CertificateRequest | null>;

  create(
    data: CertificateRequestData,
    createdBy: string | null,
  ): Promise<CertificateRequest>;
  /** Returns null if the request is no longer pending. */
  updatePending(
    id: string,
    data: CertificateRequestData,
  ): Promise<CertificateRequest | null>;
  /** Returns false if the request is not in PENDIENTE. Persists observaciones. */
  markAsRealized(
    id: string,
    observations: string | null,
  ): Promise<boolean>;
  /** Returns false if the request is not in REALIZADA. */
  signRequest(id: string): Promise<boolean>;
  /** Returns null if not FIRMADA or without payment (ABONADO/EXENTO). */
  markAsDelivered(
    id: string,
    data: DeliveryData,
  ): Promise<CertificateRequest | null>;
  /** Returns null if the request is no longer pending. */
  cancelPending(id: string, reason: string): Promise<CertificateRequest | null>;
  /** Returns null if the request is cancelled or delivered (RETIRADA). */
  addPayment(id: string, payment: Payment): Promise<CertificateRequest | null>;
}

export const CERTIFICATE_REQUEST_REPOSITORY = 'CERTIFICATE_REQUEST_REPOSITORY';

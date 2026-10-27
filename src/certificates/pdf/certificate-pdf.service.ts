import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CERTIFICATE_REQUEST_REPOSITORY } from '../domain/certificate-request.repository.js';
import type { CertificateRequestRepository } from '../domain/certificate-request.repository.js';
import type { RequestStatus } from '../domain/certificate-request.enums.js';
import { buildCertificatePdf } from './certificate-pdf.builder.js';
import { toCertificatePdfViewModel } from './certificate-pdf.mapper.js';

const PDF_ALLOWED_STATUSES: readonly RequestStatus[] = [
  'REALIZADA',
  'FIRMADA',
  'RETIRADA',
];

const PDF_NOT_ALLOWED =
  'Solo se puede generar el PDF de solicitudes realizadas, firmadas o retiradas';

/** Generates on-demand certificate PDFs (never persisted). */
@Injectable()
export class CertificatePdfService {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly repo: CertificateRequestRepository,
  ) {}

  /**
   * Loads the request, checks status, and returns PDF buffer + filename.
   * @param observations optional text under OBSERVACIONES (defaults to stored value)
   */
  async generatePdf(
    id: string,
    observations?: string | null,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.repo.findById(id);
    if (!request) throw new NotFoundException('La solicitud no existe');
    if (!PDF_ALLOWED_STATUSES.includes(request.estado)) {
      throw new ConflictException(PDF_NOT_ALLOWED);
    }
    const view = toCertificatePdfViewModel(
      request,
      new Date(),
      observations !== undefined ? observations : request.observaciones,
    );
    return {
      buffer: buildCertificatePdf(view),
      filename: view.filename,
    };
  }
}

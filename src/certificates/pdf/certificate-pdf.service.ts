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

const PDF_PERMITIDOS: readonly RequestStatus[] = [
  'REALIZADA',
  'FIRMADA',
  'RETIRADA',
];

const NO_PDF =
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
   * @param observaciones optional text under OBSERVACIONES (defaults to stored value)
   */
  async generatePdf(
    id: string,
    observaciones?: string | null,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const solicitud = await this.repo.findById(id);
    if (!solicitud) throw new NotFoundException('La solicitud no existe');
    if (!PDF_PERMITIDOS.includes(solicitud.estado)) {
      throw new ConflictException(NO_PDF);
    }
    const view = toCertificatePdfViewModel(
      solicitud,
      new Date(),
      observaciones !== undefined ? observaciones : solicitud.observaciones,
    );
    return {
      buffer: buildCertificatePdf(view),
      filename: view.filename,
    };
  }
}

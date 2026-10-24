import { Module } from '@nestjs/common';
import { CertificateRequestController } from './certificate-request.controller.js';
import { CertificateRequestService } from './certificate-request.service.js';
import { CertificatePdfService } from './pdf/certificate-pdf.service.js';
import { SupabaseCertificateRequestRepository } from './repositories/supabase-certificate-request.repository.js';
import { CERTIFICATE_REQUEST_REPOSITORY } from './domain/certificate-request.repository.js';

/** Wires certificate request HTTP API, service and Supabase repository. */
@Module({
  controllers: [CertificateRequestController],
  providers: [
    CertificateRequestService,
    CertificatePdfService,
    {
      provide: CERTIFICATE_REQUEST_REPOSITORY,
      useClass: SupabaseCertificateRequestRepository,
    },
  ],
})
export class CertificateRequestModule {}

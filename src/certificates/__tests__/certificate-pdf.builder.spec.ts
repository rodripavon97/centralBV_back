import { buildCertificatePdf } from '../pdf/certificate-pdf.builder.js';
import type { CertificatePdfViewModel } from '../pdf/certificate-pdf.mapper.js';

describe('buildCertificatePdf', () => {
  const viewModel = (): CertificatePdfViewModel => ({
    applicant: 'Lucía Fernández',
    dni: '30.112.456',
    address: 'Calle San Martín 450',
    locality: 'Morón',
    district: 'Morón',
    reason: 'Constancia para el seguro',
    losses: 'Daños en cocina',
    presentedTo: 'La Caja Seguros',
    reportNumber: 'P-2026-0142',
    dateDisplay: '11/10/2026',
    time: '18:20',
    observations: 'Se acompañan fotografías.',
    vehiclePlate: null,
    policyNumber: 'POL-998877',
    footerDate: 'JOSÉ C. PAZ, 11 DE OCTUBRE DE 2026.',
    filename: 'Constancia_Lucia_11-10-2026.pdf',
  });

  it('genera un Buffer PDF válido de 3 páginas', () => {
    const buffer = buildCertificatePdf(viewModel());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('incluye patente y omite observaciones vacías sin fallar', () => {
    const buffer = buildCertificatePdf({
      ...viewModel(),
      observations: null,
      vehiclePlate: 'AB123CD',
      policyNumber: null,
    });
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});

import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CertificatePdfService } from '../pdf/certificate-pdf.service.js';
import { CERTIFICATE_REQUEST_REPOSITORY } from '../domain/certificate-request.repository.js';
import type { CertificateRequest } from '../domain/certificate-request.entity.js';
import type { RequestStatus } from '../domain/certificate-request.enums.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

const request = (
  estado: RequestStatus = 'REALIZADA',
): CertificateRequest => ({
  id: ID,
  numero: 'SOL-0001',
  estado,
  fechaAlta: '2026-10-11T21:20:00Z',
  damnificado: {
    nombre: 'Lucía Fernández',
    dni: '30112456',
    telefono: null,
  },
  siniestro: {
    tipo: 'VIVIENDA',
    fecha: '2026-10-11',
    hora: '18:20',
    direccion: 'Calle San Martín 450',
    numeroParte: 'P-2026-0142',
    motivo: 'Constancia para el seguro',
    localidad: 'Morón',
    partido: 'Morón',
    perdidas: 'Daños en cocina',
    patenteVehiculo: null,
  },
  constancia: {
    destino: 'SEGURO',
    razonSocial: 'La Caja Seguros',
    numeroPoliza: 'POL-998877',
  },
  abono: null,
  observaciones: 'Se acompañan fotos',
  motivoCancelacion: null,
  canceladoEn: null,
  retiradoEn: null,
  retiradoPorNombre: null,
  retiradoPorDni: null,
});

describe('CertificatePdfService', () => {
  let service: CertificatePdfService;
  let repo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = { findById: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatePdfService,
        { provide: CERTIFICATE_REQUEST_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(CertificatePdfService);
  });

  it('returns 404 if the request does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.generatePdf(ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['PENDIENTE', 'CANCELADA'] as const)(
    'returns 409 if status is %s',
    async (estado) => {
      repo.findById.mockResolvedValue(request(estado));
      await expect(service.generatePdf(ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );

  it.each(['REALIZADA', 'FIRMADA', 'RETIRADA'] as const)(
    'generates a valid PDF when status is %s',
    async (estado) => {
      repo.findById.mockResolvedValue(request(estado));
      const { buffer, filename } = await service.generatePdf(ID);
      expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
      expect(filename).toContain('Constancia_');
      expect(filename).toMatch(/\.pdf$/);
    },
  );

  it('accepts observations as a parameter', async () => {
    repo.findById.mockResolvedValue(request('REALIZADA'));
    const { buffer } = await service.generatePdf(ID, 'Texto bajo OBSERVACIONES');
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});

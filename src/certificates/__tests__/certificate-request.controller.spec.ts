import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CertificateRequestController } from '../certificate-request.controller.js';
import { CertificateRequestService } from '../certificate-request.service.js';
import { CertificatePdfService } from '../pdf/certificate-pdf.service.js';
import { CreateCertificateRequestDto } from '../dtos/create-certificate-request.dto.js';
import { ListCertificateRequestsDto } from '../dtos/list-certificate-requests.dto.js';
import { CancelCertificateRequestDto } from '../dtos/cancel-certificate-request.dto.js';
import { RealizeCertificateRequestDto } from '../dtos/realize-certificate-request.dto.js';
import { AddPaymentDto } from '../dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from '../dtos/deliver-certificate-request.dto.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

describe('CertificateRequestController', () => {
  let controller: CertificateRequestController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updatePending: ReturnType<typeof vi.fn>;
    cancelRequest: ReturnType<typeof vi.fn>;
    realizeRequest: ReturnType<typeof vi.fn>;
    signRequest: ReturnType<typeof vi.fn>;
    addPayment: ReturnType<typeof vi.fn>;
    markAsDelivered: ReturnType<typeof vi.fn>;
  };
  let pdfService: {
    generatePdf: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updatePending: vi.fn(),
      cancelRequest: vi.fn(),
      realizeRequest: vi.fn(),
      signRequest: vi.fn(),
      addPayment: vi.fn(),
      markAsDelivered: vi.fn(),
    };
    pdfService = {
      generatePdf: vi.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF-1.4'),
        filename: 'Constancia_Test_11-10-2026.pdf',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificateRequestController],
      providers: [
        { provide: CertificateRequestService, useValue: service },
        { provide: CertificatePdfService, useValue: pdfService },
      ],
    }).compile();
    controller = module.get(CertificateRequestController);
  });

  it('list delega en findAll', async () => {
    const query = new ListCertificateRequestsDto();
    service.findAll.mockResolvedValue({ items: [], total: 0 });
    await controller.list(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('obtener delega en findById', async () => {
    service.findById.mockResolvedValue({ id: ID });
    await controller.obtener(ID);
    expect(service.findById).toHaveBeenCalledWith(ID);
  });

  it('pdf delega en CertificatePdfService', async () => {
    const result = await controller.pdf(ID);
    expect(pdfService.generatePdf).toHaveBeenCalledWith(ID);
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('create usa el userId del request o null', async () => {
    const dto = new CreateCertificateRequestDto();
    service.create.mockResolvedValue({ id: ID });
    await controller.create(dto, { user: { userId: 'u-1' } } as never);
    expect(service.create).toHaveBeenCalledWith(dto, 'u-1');
    await controller.create(dto, {} as never);
    expect(service.create).toHaveBeenCalledWith(dto, null);
  });

  it('actualizar delega en updatePending', async () => {
    const dto = new CreateCertificateRequestDto();
    await controller.actualizar(ID, dto);
    expect(service.updatePending).toHaveBeenCalledWith(ID, dto);
  });

  it('cancelar pasa el motivo al service', async () => {
    const dto = Object.assign(new CancelCertificateRequestDto(), {
      motivo: 'No corresponde',
    });
    await controller.cancelar(ID, dto);
    expect(service.cancelRequest).toHaveBeenCalledWith(ID, 'No corresponde');
  });

  it('generarConstancia marca REALIZADA, pasa observaciones al PDF y lo devuelve', async () => {
    const dto = Object.assign(new RealizeCertificateRequestDto(), {
      observaciones: 'Nota',
    });
    service.realizeRequest.mockResolvedValue({ id: ID, estado: 'REALIZADA' });
    const result = await controller.generarConstancia(ID, dto);
    expect(service.realizeRequest).toHaveBeenCalledWith(ID, 'Nota');
    expect(pdfService.generatePdf).toHaveBeenCalledWith(ID, 'Nota');
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('firmar delega en signRequest', async () => {
    await controller.firmar(ID);
    expect(service.signRequest).toHaveBeenCalledWith(ID);
  });

  it('abonar delega en addPayment', async () => {
    const dto = new AddPaymentDto();
    await controller.abonar(ID, dto);
    expect(service.addPayment).toHaveBeenCalledWith(ID, dto);
  });

  it('entregar delega en markAsDelivered', async () => {
    const dto = new DeliverCertificateRequestDto();
    await controller.entregar(ID, dto);
    expect(service.markAsDelivered).toHaveBeenCalledWith(ID, dto);
  });
});

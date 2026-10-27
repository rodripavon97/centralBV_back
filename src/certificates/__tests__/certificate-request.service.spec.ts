import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CertificateRequestService } from '../certificate-request.service.js';
import { CERTIFICATE_REQUEST_REPOSITORY } from '../domain/certificate-request.repository.js';
import type {
  CertificateRequest,
  Payment,
} from '../domain/certificate-request.entity.js';
import type { RequestStatus } from '../domain/certificate-request.enums.js';
import { CreateCertificateRequestDto } from '../dtos/create-certificate-request.dto.js';
import { ListCertificateRequestsDto } from '../dtos/list-certificate-requests.dto.js';
import { ListCompletedCertificateRequestsDto } from '../dtos/list-completed-certificate-requests.dto.js';
import { AddPaymentDto } from '../dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from '../dtos/deliver-certificate-request.dto.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

const requestFixture = (
  estado: RequestStatus = 'PENDIENTE',
  abono: Payment | null = null,
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
  abono,
  observaciones: null,
  motivoCancelacion: null,
  canceladoEn: null,
  retiradoEn: null,
  retiradoPorNombre: null,
  retiradoPorDni: null,
});

const dto = (fecha = '2026-10-11', hora = '18:20') =>
  Object.assign(new CreateCertificateRequestDto(), {
    damnificado: {
      nombre: 'Lucía Fernández',
      dni: '30112456',
      telefono: null,
    },
    siniestro: {
      tipo: 'VIVIENDA' as const,
      fecha,
      hora,
      direccion: 'Calle San Martín 450',
      numeroParte: 'P-2026-0142',
      motivo: 'Constancia para el seguro',
      localidad: 'Morón',
      partido: 'Morón',
      perdidas: 'Daños en cocina',
      patenteVehiculo: null,
    },
    constancia: {
      destino: 'SEGURO' as const,
      razonSocial: 'La Caja Seguros',
      numeroPoliza: 'POL-998877',
    },
  });

describe('CertificateRequestService', () => {
  let service: CertificateRequestService;
  let repo: {
    findAll: ReturnType<typeof vi.fn>;
    findCompleted: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updatePending: ReturnType<typeof vi.fn>;
    cancelPending: ReturnType<typeof vi.fn>;
    markAsRealized: ReturnType<typeof vi.fn>;
    signRequest: ReturnType<typeof vi.fn>;
    addPayment: ReturnType<typeof vi.fn>;
    markAsDelivered: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repo = {
      findAll: vi.fn(),
      findCompleted: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updatePending: vi.fn(),
      cancelPending: vi.fn(),
      markAsRealized: vi.fn(),
      signRequest: vi.fn(),
      addPayment: vi.fn(),
      markAsDelivered: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateRequestService,
        { provide: CERTIFICATE_REQUEST_REPOSITORY, useValue: repo },
      ],
    }).compile();
    service = module.get(CertificateRequestService);
  });

  describe('findAll (US09)', () => {
    it('computes pages with 20 records per page', async () => {
      repo.findAll.mockResolvedValue({ items: [requestFixture()], total: 47 });
      const query = Object.assign(new ListCertificateRequestsDto(), {
        pagina: 2,
      });

      const result = await service.findAll(query);

      expect(repo.findAll).toHaveBeenCalledWith({
        busqueda: undefined,
        estado: undefined,
        orden: 'desc',
        pagina: 2,
        porPagina: 20,
      });
      expect(result).toMatchObject({
        total: 47,
        pagina: 2,
        paginas: 3,
        porPagina: 20,
      });
    });

    it('clamps the requested page to the last existing page', async () => {
      repo.findAll.mockResolvedValue({ items: [], total: 5 });
      const result = await service.findAll(
        Object.assign(new ListCertificateRequestsDto(), { pagina: 9 }),
      );
      expect(result).toMatchObject({ pagina: 1, paginas: 1 });
    });

    it('ignores an empty search', async () => {
      repo.findAll.mockResolvedValue({ items: [], total: 0 });
      await service.findAll(
        Object.assign(new ListCertificateRequestsDto(), { busqueda: '   ' }),
      );
      expect(repo.findAll.mock.calls[0][0].busqueda).toBeUndefined();
    });
  });

  describe('findCompleted', () => {
    it('computes pages with 20 records per page', async () => {
      repo.findCompleted.mockResolvedValue({
        items: [requestFixture('RETIRADA')],
        total: 47,
      });
      const query = Object.assign(new ListCompletedCertificateRequestsDto(), {
        pagina: 2,
      });

      const result = await service.findCompleted(query);

      expect(repo.findCompleted).toHaveBeenCalledWith({
        busqueda: undefined,
        orden: 'desc',
        pagina: 2,
        porPagina: 20,
      });
      expect(result).toMatchObject({
        total: 47,
        pagina: 2,
        paginas: 3,
        porPagina: 20,
      });
    });

    it('clamps the requested page to the last existing page', async () => {
      repo.findCompleted.mockResolvedValue({ items: [], total: 5 });
      const result = await service.findCompleted(
        Object.assign(new ListCompletedCertificateRequestsDto(), {
          pagina: 9,
        }),
      );
      expect(result).toMatchObject({ pagina: 1, paginas: 1 });
    });

    it('ignores an empty search and does not send estado', async () => {
      repo.findCompleted.mockResolvedValue({ items: [], total: 0 });
      await service.findCompleted(
        Object.assign(new ListCompletedCertificateRequestsDto(), {
          busqueda: '   ',
        }),
      );
      expect(repo.findCompleted).toHaveBeenCalledWith({
        busqueda: undefined,
        orden: 'desc',
        pagina: 1,
        porPagina: 20,
      });
      expect(repo.findCompleted.mock.calls[0][0]).not.toHaveProperty('estado');
    });
  });

  describe('create (US08)', () => {
    it('saves the request with the user who creates it', async () => {
      repo.create.mockResolvedValue(requestFixture());
      await service.create(dto(), 'user-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siniestro: expect.objectContaining({
            fecha: '2026-10-11',
            hora: '18:20',
            direccion: 'Calle San Martín 450',
            numeroParte: 'P-2026-0142',
          }),
          constancia: expect.objectContaining({
            destino: 'SEGURO',
            razonSocial: 'La Caja Seguros',
            numeroPoliza: 'POL-998877',
          }),
        }),
        'user-1',
      );
    });

    it('rejects a non-existent date', async () => {
      await expect(
        service.create(dto('2026-02-30', '10:00'), null),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a future date', async () => {
      await expect(
        service.create(dto('2999-01-01', '10:00'), null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a plate when type is VEHICULAR', async () => {
      const body = dto();
      body.siniestro.tipo = 'VEHICULAR';
      body.siniestro.patenteVehiculo = null;
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('requires a policy when destination is SEGURO', async () => {
      const body = dto();
      body.constancia.numeroPoliza = null;
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a policy when destination is ACCION_SOCIAL', async () => {
      const body = dto();
      body.constancia.destino = 'ACCION_SOCIAL';
      body.constancia.numeroPoliza = 'POL-1';
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('returns 404 if the request does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the request if it exists', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    });
  });

  describe('updatePending (US13)', () => {
    it('edits a pending request', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      repo.updatePending.mockResolvedValue(requestFixture());
      await expect(service.updatePending(ID, dto())).resolves.toMatchObject({
        estado: 'PENDIENTE',
      });
    });

    it.each(['REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'does not allow editing a %s request',
      async (estado) => {
        repo.findById.mockResolvedValue(requestFixture(estado));
        await expect(service.updatePending(ID, dto())).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.updatePending).not.toHaveBeenCalled();
      },
    );

    it('returns conflict if it stopped being pending while editing', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      repo.updatePending.mockResolvedValue(null);
      await expect(service.updatePending(ID, dto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('cancelRequest (US13)', () => {
    it('cancels a pending request with its reason', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      repo.cancelPending.mockResolvedValue({
        ...requestFixture('CANCELADA'),
        motivoCancelacion: 'No corresponde',
      });

      const result = await service.cancelRequest(ID, 'No corresponde');

      expect(repo.cancelPending).toHaveBeenCalledWith(ID, 'No corresponde');
      expect(result.estado).toBe('CANCELADA');
    });

    it('does not allow cancelling a signed request', async () => {
      repo.findById.mockResolvedValue(requestFixture('FIRMADA'));
      await expect(
        service.cancelRequest(ID, 'No corresponde'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.cancelPending).not.toHaveBeenCalled();
    });

    it('returns conflict if it stopped being pending when cancelling', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      repo.cancelPending.mockResolvedValue(null);
      await expect(
        service.cancelRequest(ID, 'No corresponde'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('realizeRequest', () => {
    it('realizes a request in PENDIENTE status', async () => {
      const realized = requestFixture('REALIZADA');
      repo.findById
        .mockResolvedValueOnce(requestFixture('PENDIENTE'))
        .mockResolvedValueOnce(realized);
      repo.markAsRealized.mockResolvedValue(true);

      await expect(
        service.realizeRequest(ID, 'Nota de prueba'),
      ).resolves.toMatchObject({
        estado: 'REALIZADA',
      });
      expect(repo.markAsRealized).toHaveBeenCalledWith(ID, 'Nota de prueba');
    });

    it.each(['REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'does not allow realizing a %s request',
      async (estado) => {
        repo.findById.mockResolvedValue(requestFixture(estado));
        await expect(service.realizeRequest(ID)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.markAsRealized).not.toHaveBeenCalled();
      },
    );

    it('returns conflict if the repo could not realize', async () => {
      repo.findById.mockResolvedValue(requestFixture('PENDIENTE'));
      repo.markAsRealized.mockResolvedValue(false);
      await expect(service.realizeRequest(ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('signRequest', () => {
    it('signs a request in REALIZADA status', async () => {
      const signed = requestFixture('FIRMADA');
      repo.findById
        .mockResolvedValueOnce(requestFixture('REALIZADA'))
        .mockResolvedValueOnce(signed);
      repo.signRequest.mockResolvedValue(true);

      await expect(service.signRequest(ID)).resolves.toMatchObject({
        estado: 'FIRMADA',
      });
      expect(repo.signRequest).toHaveBeenCalledWith(ID);
    });

    it.each(['PENDIENTE', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'does not allow signing a %s request',
      async (estado) => {
        repo.findById.mockResolvedValue(requestFixture(estado));
        await expect(service.signRequest(ID)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.signRequest).not.toHaveBeenCalled();
      },
    );

    it('returns conflict if the repo could not sign', async () => {
      repo.findById.mockResolvedValue(requestFixture('REALIZADA'));
      repo.signRequest.mockResolvedValue(false);
      await expect(service.signRequest(ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('addPayment', () => {
    const paidDto = () =>
      Object.assign(new AddPaymentDto(), {
        estado: 'ABONADO' as const,
        monto: 1500,
        metodoPago: 'EFECTIVO' as const,
      });

    const exemptDto = () =>
      Object.assign(new AddPaymentDto(), {
        estado: 'EXENTO' as const,
        motivoExento: 'Acción social',
      });

    it('registers an ABONADO payment', async () => {
      const withPayment = {
        ...requestFixture('FIRMADA'),
        abono: {
          estado: 'ABONADO' as const,
          monto: 1500,
          metodoPago: 'EFECTIVO' as const,
          fechaPago: '2026-10-12T10:00:00Z',
          motivoExento: null,
        },
      };
      repo.findById.mockResolvedValue(requestFixture('FIRMADA'));
      repo.addPayment.mockResolvedValue(withPayment);

      const result = await service.addPayment(ID, paidDto());

      expect(repo.addPayment).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({
          estado: 'ABONADO',
          monto: 1500,
          metodoPago: 'EFECTIVO',
          motivoExento: null,
        }),
      );
      expect(result.abono?.estado).toBe('ABONADO');
    });

    it('registers an EXENTO payment', async () => {
      repo.findById.mockResolvedValue(requestFixture('REALIZADA'));
      repo.addPayment.mockResolvedValue({
        ...requestFixture('REALIZADA'),
        abono: {
          estado: 'EXENTO',
          monto: null,
          metodoPago: null,
          fechaPago: '2026-10-12T10:00:00Z',
          motivoExento: 'Acción social',
        },
      });

      await service.addPayment(ID, exemptDto());

      expect(repo.addPayment).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({
          estado: 'EXENTO',
          monto: null,
          metodoPago: null,
          motivoExento: 'Acción social',
        }),
      );
    });

    it('rejects payment on a cancelled request', async () => {
      repo.findById.mockResolvedValue(requestFixture('CANCELADA'));
      await expect(service.addPayment(ID, paidDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.addPayment).not.toHaveBeenCalled();
    });

    it('keeps the original payment date when editing a payment', async () => {
      const originalDate = '2026-10-12T10:00:00Z';
      repo.findById.mockResolvedValue(
        requestFixture('FIRMADA', {
          estado: 'ABONADO',
          monto: 100,
          metodoPago: 'EFECTIVO',
          fechaPago: originalDate,
          motivoExento: null,
        }),
      );
      repo.addPayment.mockResolvedValue(
        requestFixture('FIRMADA', {
          estado: 'ABONADO',
          monto: 1500,
          metodoPago: 'EFECTIVO',
          fechaPago: originalDate,
          motivoExento: null,
        }),
      );

      await service.addPayment(ID, paidDto());

      expect(repo.addPayment).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ fechaPago: originalDate }),
      );
    });

    it('rejects EXENTO with amount or method', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      await expect(
        service.addPayment(
          ID,
          Object.assign(exemptDto(), { monto: 100 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.addPayment(
          ID,
          Object.assign(exemptDto(), { metodoPago: 'EFECTIVO' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects EXENTO without a reason', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      await expect(
        service.addPayment(
          ID,
          Object.assign(new AddPaymentDto(), {
            estado: 'EXENTO',
            motivoExento: '   ',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects ABONADO without amount or method', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      await expect(
        service.addPayment(
          ID,
          Object.assign(new AddPaymentDto(), { estado: 'ABONADO', monto: 10 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.addPayment(
          ID,
          Object.assign(new AddPaymentDto(), {
            estado: 'ABONADO',
            metodoPago: 'EFECTIVO',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns conflict if the repo could not register the payment', async () => {
      repo.findById.mockResolvedValue(requestFixture());
      repo.addPayment.mockResolvedValue(null);
      await expect(service.addPayment(ID, paidDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('markAsDelivered', () => {
    const paymentOk: Payment = {
      estado: 'ABONADO',
      monto: 1500,
      metodoPago: 'EFECTIVO',
      fechaPago: '2026-10-12T10:00:00Z',
      motivoExento: null,
    };

    it('delivers a signed and paid request', async () => {
      const delivered = {
        ...requestFixture('RETIRADA', paymentOk),
        retiradoPorNombre: 'María López',
        retiradoPorDni: '30112456',
      };
      repo.findById.mockResolvedValue(requestFixture('FIRMADA', paymentOk));
      repo.markAsDelivered.mockResolvedValue(delivered);

      const deliveryDto = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      const result = await service.markAsDelivered(ID, deliveryDto);

      expect(repo.markAsDelivered).toHaveBeenCalledWith(ID, {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      expect(result.estado).toBe('RETIRADA');
    });

    it('delivers with an EXENTO payment', async () => {
      const exento: Payment = {
        estado: 'EXENTO',
        monto: null,
        metodoPago: null,
        fechaPago: '2026-10-12T10:00:00Z',
        motivoExento: 'Acción social',
      };
      const deliveryDto = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(requestFixture('FIRMADA', exento));
      repo.markAsDelivered.mockResolvedValue(requestFixture('RETIRADA', exento));

      await service.markAsDelivered(ID, deliveryDto);

      expect(repo.markAsDelivered).toHaveBeenCalledWith(ID, {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
    });

    it('does not deliver if not FIRMADA', async () => {
      const deliveryDto = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(requestFixture('REALIZADA', paymentOk));
      await expect(
        service.markAsDelivered(ID, deliveryDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.markAsDelivered).not.toHaveBeenCalled();
    });

    it('does not deliver without a payment', async () => {
      const deliveryDto = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(requestFixture('FIRMADA'));
      await expect(
        service.markAsDelivered(ID, deliveryDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns conflict if the repo could not mark delivery', async () => {
      const deliveryDto = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(requestFixture('FIRMADA', paymentOk));
      repo.markAsDelivered.mockResolvedValue(null);
      await expect(
        service.markAsDelivered(ID, deliveryDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

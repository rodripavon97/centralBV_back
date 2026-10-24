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
import { AddPaymentDto } from '../dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from '../dtos/deliver-certificate-request.dto.js';

const ID = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

const solicitud = (
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
    it('calcula las páginas con 20 registros por página', async () => {
      repo.findAll.mockResolvedValue({ items: [solicitud()], total: 47 });
      const query = Object.assign(new ListCertificateRequestsDto(), {
        pagina: 2,
      });

      const resultado = await service.findAll(query);

      expect(repo.findAll).toHaveBeenCalledWith({
        busqueda: undefined,
        estado: undefined,
        orden: 'desc',
        pagina: 2,
        porPagina: 20,
      });
      expect(resultado).toMatchObject({
        total: 47,
        pagina: 2,
        paginas: 3,
        porPagina: 20,
      });
    });

    it('limita la página pedida a la última que existe', async () => {
      repo.findAll.mockResolvedValue({ items: [], total: 5 });
      const resultado = await service.findAll(
        Object.assign(new ListCertificateRequestsDto(), { pagina: 9 }),
      );
      expect(resultado).toMatchObject({ pagina: 1, paginas: 1 });
    });

    it('ignora una búsqueda vacía', async () => {
      repo.findAll.mockResolvedValue({ items: [], total: 0 });
      await service.findAll(
        Object.assign(new ListCertificateRequestsDto(), { busqueda: '   ' }),
      );
      expect(repo.findAll.mock.calls[0][0].busqueda).toBeUndefined();
    });
  });

  describe('create (US08)', () => {
    it('guarda la solicitud con el usuario que la carga', async () => {
      repo.create.mockResolvedValue(solicitud());
      await service.create(dto(), 'usuario-1');
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
        'usuario-1',
      );
    });

    it('rechaza una fecha que no existe', async () => {
      await expect(
        service.create(dto('2026-02-30', '10:00'), null),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rechaza una fecha futura', async () => {
      await expect(
        service.create(dto('2999-01-01', '10:00'), null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('exige patente cuando el tipo es VEHICULAR', async () => {
      const body = dto();
      body.siniestro.tipo = 'VEHICULAR';
      body.siniestro.patenteVehiculo = null;
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('exige póliza cuando el destino es SEGURO', async () => {
      const body = dto();
      body.constancia.numeroPoliza = null;
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza póliza cuando el destino es ACCION_SOCIAL', async () => {
      const body = dto();
      body.constancia.destino = 'ACCION_SOCIAL';
      body.constancia.numeroPoliza = 'POL-1';
      await expect(service.create(body, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('devuelve 404 si la solicitud no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('devuelve la solicitud si existe', async () => {
      repo.findById.mockResolvedValue(solicitud());
      await expect(service.findById(ID)).resolves.toMatchObject({ id: ID });
    });
  });

  describe('updatePending (US13)', () => {
    it('edita una solicitud pendiente', async () => {
      repo.findById.mockResolvedValue(solicitud());
      repo.updatePending.mockResolvedValue(solicitud());
      await expect(service.updatePending(ID, dto())).resolves.toMatchObject({
        estado: 'PENDIENTE',
      });
    });

    it.each(['REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'no permite editar una solicitud %s',
      async (estado) => {
        repo.findById.mockResolvedValue(solicitud(estado));
        await expect(service.updatePending(ID, dto())).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.updatePending).not.toHaveBeenCalled();
      },
    );

    it('devuelve conflicto si dejó de estar pendiente mientras se editaba', async () => {
      repo.findById.mockResolvedValue(solicitud());
      repo.updatePending.mockResolvedValue(null);
      await expect(service.updatePending(ID, dto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('cancelRequest (US13)', () => {
    it('cancela una solicitud pendiente con su motivo', async () => {
      repo.findById.mockResolvedValue(solicitud());
      repo.cancelPending.mockResolvedValue({
        ...solicitud('CANCELADA'),
        motivoCancelacion: 'No corresponde',
      });

      const resultado = await service.cancelRequest(ID, 'No corresponde');

      expect(repo.cancelPending).toHaveBeenCalledWith(ID, 'No corresponde');
      expect(resultado.estado).toBe('CANCELADA');
    });

    it('no permite cancelar una solicitud firmada', async () => {
      repo.findById.mockResolvedValue(solicitud('FIRMADA'));
      await expect(
        service.cancelRequest(ID, 'No corresponde'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.cancelPending).not.toHaveBeenCalled();
    });

    it('devuelve conflicto si dejó de estar pendiente al cancelar', async () => {
      repo.findById.mockResolvedValue(solicitud());
      repo.cancelPending.mockResolvedValue(null);
      await expect(
        service.cancelRequest(ID, 'No corresponde'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('realizeRequest', () => {
    it('realiza una solicitud en estado PENDIENTE', async () => {
      const realizada = solicitud('REALIZADA');
      repo.findById
        .mockResolvedValueOnce(solicitud('PENDIENTE'))
        .mockResolvedValueOnce(realizada);
      repo.markAsRealized.mockResolvedValue(true);

      await expect(
        service.realizeRequest(ID, 'Nota de prueba'),
      ).resolves.toMatchObject({
        estado: 'REALIZADA',
      });
      expect(repo.markAsRealized).toHaveBeenCalledWith(ID, 'Nota de prueba');
    });

    it.each(['REALIZADA', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'no permite realizar una solicitud %s',
      async (estado) => {
        repo.findById.mockResolvedValue(solicitud(estado));
        await expect(service.realizeRequest(ID)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.markAsRealized).not.toHaveBeenCalled();
      },
    );

    it('devuelve conflicto si el repo no pudo realizar', async () => {
      repo.findById.mockResolvedValue(solicitud('PENDIENTE'));
      repo.markAsRealized.mockResolvedValue(false);
      await expect(service.realizeRequest(ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('signRequest', () => {
    it('firma una solicitud en estado REALIZADA', async () => {
      const firmada = solicitud('FIRMADA');
      repo.findById
        .mockResolvedValueOnce(solicitud('REALIZADA'))
        .mockResolvedValueOnce(firmada);
      repo.signRequest.mockResolvedValue(true);

      await expect(service.signRequest(ID)).resolves.toMatchObject({
        estado: 'FIRMADA',
      });
      expect(repo.signRequest).toHaveBeenCalledWith(ID);
    });

    it.each(['PENDIENTE', 'FIRMADA', 'RETIRADA', 'CANCELADA'] as const)(
      'no permite firmar una solicitud %s',
      async (estado) => {
        repo.findById.mockResolvedValue(solicitud(estado));
        await expect(service.signRequest(ID)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(repo.signRequest).not.toHaveBeenCalled();
      },
    );

    it('devuelve conflicto si el repo no pudo firmar', async () => {
      repo.findById.mockResolvedValue(solicitud('REALIZADA'));
      repo.signRequest.mockResolvedValue(false);
      await expect(service.signRequest(ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('addPayment', () => {
    const abonadoDto = () =>
      Object.assign(new AddPaymentDto(), {
        estado: 'ABONADO' as const,
        monto: 1500,
        metodoPago: 'EFECTIVO' as const,
      });

    const exentoDto = () =>
      Object.assign(new AddPaymentDto(), {
        estado: 'EXENTO' as const,
        motivoExento: 'Acción social',
      });

    it('registra un abono ABONADO', async () => {
      const conAbono = {
        ...solicitud('FIRMADA'),
        abono: {
          estado: 'ABONADO' as const,
          monto: 1500,
          metodoPago: 'EFECTIVO' as const,
          fechaPago: '2026-10-12T10:00:00Z',
          motivoExento: null,
        },
      };
      repo.findById.mockResolvedValue(solicitud('FIRMADA'));
      repo.addPayment.mockResolvedValue(conAbono);

      const resultado = await service.addPayment(ID, abonadoDto());

      expect(repo.addPayment).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({
          estado: 'ABONADO',
          monto: 1500,
          metodoPago: 'EFECTIVO',
          motivoExento: null,
        }),
      );
      expect(resultado.abono?.estado).toBe('ABONADO');
    });

    it('registra un abono EXENTO', async () => {
      repo.findById.mockResolvedValue(solicitud('REALIZADA'));
      repo.addPayment.mockResolvedValue({
        ...solicitud('REALIZADA'),
        abono: {
          estado: 'EXENTO',
          monto: null,
          metodoPago: null,
          fechaPago: '2026-10-12T10:00:00Z',
          motivoExento: 'Acción social',
        },
      });

      await service.addPayment(ID, exentoDto());

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

    it('rechaza abono en solicitud cancelada', async () => {
      repo.findById.mockResolvedValue(solicitud('CANCELADA'));
      await expect(service.addPayment(ID, abonadoDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.addPayment).not.toHaveBeenCalled();
    });

    it('al editar un abono conserva la fecha de pago original', async () => {
      const fechaOriginal = '2026-10-12T10:00:00Z';
      repo.findById.mockResolvedValue(
        solicitud('FIRMADA', {
          estado: 'ABONADO',
          monto: 100,
          metodoPago: 'EFECTIVO',
          fechaPago: fechaOriginal,
          motivoExento: null,
        }),
      );
      repo.addPayment.mockResolvedValue(
        solicitud('FIRMADA', {
          estado: 'ABONADO',
          monto: 1500,
          metodoPago: 'EFECTIVO',
          fechaPago: fechaOriginal,
          motivoExento: null,
        }),
      );

      await service.addPayment(ID, abonadoDto());

      expect(repo.addPayment).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ fechaPago: fechaOriginal }),
      );
    });

    it('rechaza EXENTO con monto o método', async () => {
      repo.findById.mockResolvedValue(solicitud());
      await expect(
        service.addPayment(
          ID,
          Object.assign(exentoDto(), { monto: 100 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.addPayment(
          ID,
          Object.assign(exentoDto(), { metodoPago: 'EFECTIVO' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza EXENTO sin motivo', async () => {
      repo.findById.mockResolvedValue(solicitud());
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

    it('rechaza ABONADO sin monto o método', async () => {
      repo.findById.mockResolvedValue(solicitud());
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

    it('devuelve conflicto si el repo no pudo registrar el abono', async () => {
      repo.findById.mockResolvedValue(solicitud());
      repo.addPayment.mockResolvedValue(null);
      await expect(service.addPayment(ID, abonadoDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('markAsDelivered', () => {
    const abonoOk: Payment = {
      estado: 'ABONADO',
      monto: 1500,
      metodoPago: 'EFECTIVO',
      fechaPago: '2026-10-12T10:00:00Z',
      motivoExento: null,
    };

    it('entrega una solicitud firmada y abonada', async () => {
      const entregada = {
        ...solicitud('RETIRADA', abonoOk),
        retiradoPorNombre: 'María López',
        retiradoPorDni: '30112456',
      };
      repo.findById.mockResolvedValue(solicitud('FIRMADA', abonoOk));
      repo.markAsDelivered.mockResolvedValue(entregada);

      const dtoEntrega = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      const resultado = await service.markAsDelivered(ID, dtoEntrega);

      expect(repo.markAsDelivered).toHaveBeenCalledWith(ID, {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      expect(resultado.estado).toBe('RETIRADA');
    });

    it('entrega con abono EXENTO', async () => {
      const exento: Payment = {
        estado: 'EXENTO',
        monto: null,
        metodoPago: null,
        fechaPago: '2026-10-12T10:00:00Z',
        motivoExento: 'Acción social',
      };
      const dtoEntrega = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(solicitud('FIRMADA', exento));
      repo.markAsDelivered.mockResolvedValue(solicitud('RETIRADA', exento));

      await service.markAsDelivered(ID, dtoEntrega);

      expect(repo.markAsDelivered).toHaveBeenCalledWith(ID, {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
    });

    it('no entrega si no está FIRMADA', async () => {
      const dtoEntrega = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(solicitud('REALIZADA', abonoOk));
      await expect(
        service.markAsDelivered(ID, dtoEntrega),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.markAsDelivered).not.toHaveBeenCalled();
    });

    it('no entrega si no tiene abono', async () => {
      const dtoEntrega = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(solicitud('FIRMADA'));
      await expect(
        service.markAsDelivered(ID, dtoEntrega),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve conflicto si el repo no pudo marcar la entrega', async () => {
      const dtoEntrega = Object.assign(new DeliverCertificateRequestDto(), {
        nombreCompleto: 'María López',
        dni: '30112456',
      });
      repo.findById.mockResolvedValue(solicitud('FIRMADA', abonoOk));
      repo.markAsDelivered.mockResolvedValue(null);
      await expect(
        service.markAsDelivered(ID, dtoEntrega),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

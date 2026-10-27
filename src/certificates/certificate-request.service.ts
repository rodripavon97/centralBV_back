import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CERTIFICATE_REQUEST_REPOSITORY } from './domain/certificate-request.repository.js';
import type {
  CertificateRequestRepository,
  CertificateRequestData,
} from './domain/certificate-request.repository.js';
import {
  isModifiable,
  canAdvanceTo,
  CertificateRequest,
  Payment,
} from './domain/certificate-request.entity.js';
import { CreateCertificateRequestDto } from './dtos/create-certificate-request.dto.js';
import { ListCertificateRequestsDto } from './dtos/list-certificate-requests.dto.js';
import { ListCompletedCertificateRequestsDto } from './dtos/list-completed-certificate-requests.dto.js';
import { AddPaymentDto } from './dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from './dtos/deliver-certificate-request.dto.js';
import {
  nowInArgentina,
  isValidDateAndTime,
  isStrictlyAfter,
} from '../common/utils/date.utils.js';
import { buildPaginatedResponse } from '../common/utils/pagination.utils.js';

const NOT_MODIFIABLE =
  'Solo se pueden editar o cancelar solicitudes pendientes';
const NOT_REALIZABLE = 'Solo se pueden realizar solicitudes en estado PENDIENTE';
const NOT_SIGNABLE = 'Solo se pueden firmar solicitudes en estado REALIZADA';
const NOT_PAYABLE =
  'No se puede registrar o editar el abono de una solicitud cancelada o entregada';
const NOT_DELIVERABLE =
  'Solo se pueden entregar solicitudes firmadas con abono registrado';
const INVALID_TRANSITION = 'La transición de estado no es válida';

/** Application rules for certificate request lifecycle and payments. */
@Injectable()
export class CertificateRequestService {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly repo: CertificateRequestRepository,
  ) {}

  /** US09: list active requests with search, status filter, sort and pagination. */
  async findAll(query: ListCertificateRequestsDto) {
    const { busqueda, estado, orden, pagina, porPagina } = query;
    const { items, total } = await this.repo.findAll({
      busqueda: busqueda?.trim() || undefined,
      estado,
      orden,
      pagina,
      porPagina,
    });
    return buildPaginatedResponse(items, total, pagina, porPagina);
  }

  /**
   * Lists completed (RETIRADA) requests with search, sort and pagination.
   * Status is fixed; there is no estado filter.
   */
  async findCompleted(query: ListCompletedCertificateRequestsDto) {
    const { busqueda, orden, pagina, porPagina } = query;
    const { items, total } = await this.repo.findCompleted({
      busqueda: busqueda?.trim() || undefined,
      orden,
      pagina,
      porPagina,
    });
    return buildPaginatedResponse(items, total, pagina, porPagina);
  }

  /** Returns the request or throws if it does not exist. */
  async findById(id: string): Promise<CertificateRequest> {
    const request = await this.repo.findById(id);
    if (!request) throw new NotFoundException('La solicitud no existe');
    return request;
  }

  /** US08: the request starts in PENDIENTE status. */
  async create(dto: CreateCertificateRequestDto, userId: string | null) {
    return this.repo.create(this.validateData(dto), userId);
  }

  /** US13: only pending requests can be edited. */
  async updatePending(id: string, dto: CreateCertificateRequestDto) {
    await this.getModifiable(id);
    const updated = await this.repo.updatePending(
      id,
      this.validateData(dto),
    );
    if (!updated) throw new ConflictException(NOT_MODIFIABLE);
    return updated;
  }

  /** US13: cancel requires a reason and leaves the request in CANCELADA. */
  async cancelRequest(id: string, reason: string) {
    const request = await this.getModifiable(id);
    if (!canAdvanceTo(request.estado, 'CANCELADA')) {
      throw new ConflictException(INVALID_TRANSITION);
    }
    const cancelled = await this.repo.cancelPending(id, reason);
    if (!cancelled) throw new ConflictException(NOT_MODIFIABLE);
    return cancelled;
  }

  /**
   * Realization requires PENDIENTE status and leaves the request in REALIZADA.
   * Persists optional observaciones for the certificate PDF.
   */
  async realizeRequest(id: string, observations: string | null = null) {
    const request = await this.findById(id);
    if (!canAdvanceTo(request.estado, 'REALIZADA')) {
      throw new ConflictException(NOT_REALIZABLE);
    }
    const realized = await this.repo.markAsRealized(id, observations);
    if (!realized) throw new ConflictException(NOT_REALIZABLE);
    return this.findById(id);
  }

  /** Signing requires REALIZADA status and leaves the request in FIRMADA. */
  async signRequest(id: string) {
    const request = await this.findById(id);
    if (!canAdvanceTo(request.estado, 'FIRMADA')) {
      throw new ConflictException(NOT_SIGNABLE);
    }
    const signed = await this.repo.signRequest(id);
    if (!signed) throw new ConflictException(NOT_SIGNABLE);
    return this.findById(id);
  }

  /**
   * Registers or edits payment (ABONADO/EXENTO), or resets it with PENDIENTE
   * (clears amount, method, reason and date).
   * ABONADO requires amount and method; EXENTO requires a reason and rejects amount/method.
   * Not allowed if the request is cancelled or already delivered (RETIRADA).
   * If a payment already existed, the original payment date is kept.
   */
  async addPayment(id: string, dto: AddPaymentDto) {
    const request = await this.findById(id);
    if (request.estado === 'CANCELADA' || request.estado === 'RETIRADA') {
      throw new ConflictException(NOT_PAYABLE);
    }
    if (dto.estado === 'EXENTO') {
      if (dto.monto != null || dto.metodoPago != null) {
        throw new BadRequestException([
          'Un pago exento no admite monto ni método de pago',
        ]);
      }
      if (!dto.motivoExento?.trim()) {
        throw new BadRequestException([
          'El motivo de la exención es obligatorio',
        ]);
      }
    }
    if (dto.estado === 'ABONADO') {
      if (dto.monto == null || dto.metodoPago == null) {
        throw new BadRequestException([
          'Un pago abonado exige monto y método de pago',
        ]);
      }
    }
    const payment: Payment = {
      estado: dto.estado,
      monto: dto.estado === 'ABONADO' ? Number(dto.monto) : null,
      metodoPago: dto.estado === 'ABONADO' ? (dto.metodoPago ?? null) : null,
      fechaPago: request.abono?.fechaPago ?? new Date().toISOString(),
      motivoExento: dto.estado === 'EXENTO' ? (dto.motivoExento ?? null) : null,
    };
    const updated = await this.repo.addPayment(id, payment);
    if (!updated) throw new ConflictException(NOT_PAYABLE);
    return updated;
  }

  /** Delivery requires FIRMADA and payment (ABONADO/EXENTO); done by the person who picks it up. */
  async markAsDelivered(id: string, dto: DeliverCertificateRequestDto) {
    const request = await this.findById(id);
    const paymentOk =
      request.abono?.estado === 'ABONADO' ||
      request.abono?.estado === 'EXENTO';
    if (!canAdvanceTo(request.estado, 'RETIRADA') || !paymentOk) {
      throw new ConflictException(NOT_DELIVERABLE);
    }
    const delivered = await this.repo.markAsDelivered(id, {
      nombreCompleto: dto.nombreCompleto,
      dni: dto.dni,
    });
    if (!delivered) throw new ConflictException(NOT_DELIVERABLE);
    return delivered;
  }

  /** Loads the request and ensures it is still modifiable (PENDIENTE). */
  private async getModifiable(id: string) {
    const request = await this.findById(id);
    if (!isModifiable(request.estado))
      throw new ConflictException(NOT_MODIFIABLE);
    return request;
  }

  /**
   * Rules that class-validator does not cover: real date/time, not in the future,
   * plate for VEHICULAR, and policy number according to destino (RN/01).
   */
  private validateData(
    dto: CreateCertificateRequestDto,
  ): CertificateRequestData {
    const { fecha, hora, tipo } = dto.siniestro;
    if (!isValidDateAndTime(fecha, hora)) {
      throw new BadRequestException([
        'La fecha y hora del siniestro no existe',
      ]);
    }
    const now = nowInArgentina();
    if (isStrictlyAfter(fecha, hora, now.date, now.time)) {
      throw new BadRequestException([
        'La fecha del siniestro no puede ser posterior al momento actual',
      ]);
    }

    if (tipo === 'VEHICULAR' && !dto.siniestro.patenteVehiculo?.trim()) {
      throw new BadRequestException([
        'La patente es obligatoria para siniestros vehiculares',
      ]);
    }
    if (tipo === 'VIVIENDA' && dto.siniestro.patenteVehiculo != null) {
      throw new BadRequestException([
        'Un siniestro de vivienda no admite patente de vehículo',
      ]);
    }

    const { destino } = dto.constancia;
    if (destino === 'SEGURO' && !dto.constancia.numeroPoliza?.trim()) {
      throw new BadRequestException([
        'El número de póliza es obligatorio para destino SEGURO',
      ]);
    }
    if (destino === 'ACCION_SOCIAL' && dto.constancia.numeroPoliza != null) {
      throw new BadRequestException([
        'Una constancia de acción social no admite número de póliza',
      ]);
    }

    const { damnificado: d, siniestro: s, constancia: c } = dto;
    return {
      damnificado: {
        nombre: d.nombre,
        dni: d.dni,
        telefono: d.telefono ?? null,
      },
      siniestro: {
        tipo: s.tipo,
        fecha: s.fecha,
        hora: s.hora,
        direccion: s.direccion,
        numeroParte: s.numeroParte,
        motivo: s.motivo,
        localidad: s.localidad,
        partido: s.partido,
        perdidas: s.perdidas,
        patenteVehiculo:
          s.tipo === 'VEHICULAR' ? (s.patenteVehiculo ?? null) : null,
      },
      constancia: {
        destino: c.destino,
        razonSocial: c.razonSocial,
        numeroPoliza: c.destino === 'SEGURO' ? (c.numeroPoliza ?? null) : null,
      },
    };
  }
}

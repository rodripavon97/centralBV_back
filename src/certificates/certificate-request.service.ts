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
import { AddPaymentDto } from './dtos/add-payment.dto.js';
import { DeliverCertificateRequestDto } from './dtos/deliver-certificate-request.dto.js';
import {
  ahoraEnArgentina,
  esFechaHoraValida,
} from '../common/utils/date.utils.js';

const NO_MODIFICABLE =
  'Solo se pueden editar o cancelar solicitudes pendientes';
const NO_FIRMABLE = 'Solo se pueden firmar solicitudes en estado REALIZADA';
const NO_ABONABLE =
  'No se puede registrar o editar el abono de una solicitud cancelada o entregada';
const NO_ENTREGABLE =
  'Solo se pueden entregar solicitudes firmadas con abono registrado';
const TRANSICION_INVALIDA = 'La transición de estado no es válida';

/** Application rules for certificate request lifecycle and payments. */
@Injectable()
export class CertificateRequestService {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly repo: CertificateRequestRepository,
  ) {}

  /** US09: list with search, status filter, sort and pagination. */
  async findAll(query: ListCertificateRequestsDto) {
    const { busqueda, estado, orden, pagina, porPagina } = query;
    const { items, total } = await this.repo.findAll({
      busqueda: busqueda?.trim() || undefined,
      estado,
      orden,
      pagina,
      porPagina,
    });
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    return {
      items,
      total,
      pagina: Math.min(pagina, paginas),
      paginas,
      porPagina,
    };
  }

  /** Returns the request or throws if it does not exist. */
  async findById(id: string): Promise<CertificateRequest> {
    const solicitud = await this.repo.findById(id);
    if (!solicitud) throw new NotFoundException('La solicitud no existe');
    return solicitud;
  }

  /** US08: the request starts in PENDIENTE status. */
  async create(dto: CreateCertificateRequestDto, usuarioId: string | null) {
    return this.repo.create(this.validateData(dto), usuarioId);
  }

  /** US13: only pending requests can be edited. */
  async updatePending(id: string, dto: CreateCertificateRequestDto) {
    await this.getModifiable(id);
    const actualizada = await this.repo.updatePending(
      id,
      this.validateData(dto),
    );
    if (!actualizada) throw new ConflictException(NO_MODIFICABLE);
    return actualizada;
  }

  /** US13: cancel requires a reason and leaves the request in CANCELADA. */
  async cancelRequest(id: string, motivo: string) {
    const solicitud = await this.getModifiable(id);
    if (!canAdvanceTo(solicitud.estado, 'CANCELADA')) {
      throw new ConflictException(TRANSICION_INVALIDA);
    }
    const cancelada = await this.repo.cancelPending(id, motivo);
    if (!cancelada) throw new ConflictException(NO_MODIFICABLE);
    return cancelada;
  }

  /** Signing requires REALIZADA status and leaves the request in FIRMADA. */
  async signRequest(id: string) {
    const solicitud = await this.findById(id);
    if (!canAdvanceTo(solicitud.estado, 'FIRMADA')) {
      throw new ConflictException(NO_FIRMABLE);
    }
    const firmada = await this.repo.signRequest(id);
    if (!firmada) throw new ConflictException(NO_FIRMABLE);
    return this.findById(id);
  }

  /**
   * Registers or edits payment (ABONADO/EXENTO).
   * ABONADO requires amount and method; EXENTO requires a reason and rejects amount/method.
   * Not allowed if the request is cancelled or already delivered (RETIRADA).
   * If a payment already existed, the original payment date is kept.
   */
  async addPayment(id: string, dto: AddPaymentDto) {
    const solicitud = await this.findById(id);
    if (solicitud.estado === 'CANCELADA' || solicitud.estado === 'RETIRADA') {
      throw new ConflictException(NO_ABONABLE);
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
      fechaPago: solicitud.abono?.fechaPago ?? new Date().toISOString(),
      motivoExento: dto.estado === 'EXENTO' ? (dto.motivoExento ?? null) : null,
    };
    const actualizada = await this.repo.addPayment(id, payment);
    if (!actualizada) throw new ConflictException(NO_ABONABLE);
    return actualizada;
  }

  /** Delivery requires FIRMADA and payment (ABONADO/EXENTO); done by the person who picks it up. */
  async markAsDelivered(id: string, dto: DeliverCertificateRequestDto) {
    const solicitud = await this.findById(id);
    const abonoOk =
      solicitud.abono?.estado === 'ABONADO' ||
      solicitud.abono?.estado === 'EXENTO';
    if (!canAdvanceTo(solicitud.estado, 'RETIRADA') || !abonoOk) {
      throw new ConflictException(NO_ENTREGABLE);
    }
    const entregada = await this.repo.markAsDelivered(id, {
      nombreCompleto: dto.nombreCompleto,
      dni: dto.dni,
    });
    if (!entregada) throw new ConflictException(NO_ENTREGABLE);
    return entregada;
  }

  /** Loads the request and ensures it is still modifiable (PENDIENTE). */
  private async getModifiable(id: string) {
    const solicitud = await this.findById(id);
    if (!isModifiable(solicitud.estado))
      throw new ConflictException(NO_MODIFICABLE);
    return solicitud;
  }

  /** Rules that class-validator does not cover: real date and not in the future. */
  private validateData(
    dto: CreateCertificateRequestDto,
  ): CertificateRequestData {
    const { fechaHora } = dto.siniestro;
    if (!esFechaHoraValida(fechaHora)) {
      throw new BadRequestException([
        'La fecha y hora del siniestro no existe',
      ]);
    }
    if (fechaHora > ahoraEnArgentina()) {
      throw new BadRequestException([
        'La fecha del siniestro no puede ser posterior al momento actual',
      ]);
    }
    const { damnificado: d, siniestro: s } = dto;
    return {
      damnificado: {
        nombre: d.nombre,
        apellido: d.apellido,
        dni: d.dni,
        telefono: d.telefono ?? null,
        domicilio: d.domicilio ?? null,
      },
      siniestro: {
        tipo: s.tipo,
        fechaHora: s.fechaHora,
        lugar: s.lugar,
        descripcion: s.descripcion,
      },
    };
  }
}

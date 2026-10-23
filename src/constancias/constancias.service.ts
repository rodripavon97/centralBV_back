import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SOLICITUD_REPOSITORY } from './domain/solicitud.repository.js';
import type { SolicitudRepository } from './domain/solicitud.repository.js';
import {
  ahoraEnArgentina,
  esFechaHoraValida,
  esModificable,
} from './domain/solicitud.entity.js';
import type { DatosSolicitud, Solicitud } from './domain/solicitud.entity.js';
import { GuardarSolicitudDto } from './dtos/guardar-solicitud.dto.js';
import { ListarSolicitudesDto } from './dtos/listar-solicitudes.dto.js';

const NO_MODIFICABLE = 'Solo se pueden editar o cancelar solicitudes pendientes';

@Injectable()
export class ConstanciasService {
  constructor(@Inject(SOLICITUD_REPOSITORY) private readonly repo: SolicitudRepository) {}

  /** US09: listado con búsqueda, filtro por estado, orden y paginación. */
  async listar(query: ListarSolicitudesDto) {
    const { busqueda, estado, orden, pagina, porPagina } = query;
    const { items, total } = await this.repo.listar({
      busqueda: busqueda?.trim() || undefined,
      estado,
      orden,
      pagina,
      porPagina,
    });
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    return { items, total, pagina: Math.min(pagina, paginas), paginas, porPagina };
  }

  async obtener(id: string): Promise<Solicitud> {
    const solicitud = await this.repo.buscarPorId(id);
    if (!solicitud) throw new NotFoundException('La solicitud no existe');
    return solicitud;
  }

  /** US08: la solicitud nace en estado PENDIENTE. */
  async crear(dto: GuardarSolicitudDto, usuarioId: string | null) {
    return this.repo.crear(this.datosValidos(dto), usuarioId);
  }

  /** US13: solo se editan solicitudes pendientes. */
  async actualizar(id: string, dto: GuardarSolicitudDto) {
    await this.obtenerModificable(id);
    const actualizada = await this.repo.actualizarPendiente(id, this.datosValidos(dto));
    if (!actualizada) throw new ConflictException(NO_MODIFICABLE);
    return actualizada;
  }

  /** US13: cancelar exige un motivo y deja la solicitud en CANCELADA. */
  async cancelar(id: string, motivo: string) {
    await this.obtenerModificable(id);
    const cancelada = await this.repo.cancelarPendiente(id, motivo);
    if (!cancelada) throw new ConflictException(NO_MODIFICABLE);
    return cancelada;
  }

  private async obtenerModificable(id: string) {
    const solicitud = await this.obtener(id);
    if (!esModificable(solicitud)) throw new ConflictException(NO_MODIFICABLE);
    return solicitud;
  }

  /** Reglas que class-validator no cubre: fecha real y no futura. */
  private datosValidos(dto: GuardarSolicitudDto): DatosSolicitud {
    const { fechaHora } = dto.siniestro;
    if (!esFechaHoraValida(fechaHora)) {
      throw new BadRequestException(['La fecha y hora del siniestro no existe']);
    }
    if (fechaHora > ahoraEnArgentina()) {
      throw new BadRequestException(['La fecha del siniestro no puede ser posterior a hoy']);
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
      siniestro: { tipo: s.tipo, fechaHora: s.fechaHora, lugar: s.lugar, descripcion: s.descripcion },
    };
  }
}

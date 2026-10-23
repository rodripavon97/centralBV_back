import type { DatosSolicitud, FiltroSolicitudes, Solicitud } from './solicitud.entity.js';

export interface SolicitudRepository {
  listar(filtro: FiltroSolicitudes): Promise<{ items: Solicitud[]; total: number }>;
  buscarPorId(id: string): Promise<Solicitud | null>;
  crear(datos: DatosSolicitud, creadoPor: string | null): Promise<Solicitud>;
  /** Devuelve null si la solicitud ya no está pendiente. */
  actualizarPendiente(id: string, datos: DatosSolicitud): Promise<Solicitud | null>;
  /** Devuelve null si la solicitud ya no está pendiente. */
  cancelarPendiente(id: string, motivo: string): Promise<Solicitud | null>;
}

export const SOLICITUD_REPOSITORY = 'SOLICITUD_REPOSITORY';

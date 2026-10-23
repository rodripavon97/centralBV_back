import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type { SolicitudRepository } from '../domain/solicitud.repository.js';
import type {
  DatosSolicitud,
  EstadoSolicitud,
  FiltroSolicitudes,
  Solicitud,
  TipoSiniestro,
} from '../domain/solicitud.entity.js';

// Fila de la vista public.solicitudes_listado (constancias + damnificados).
interface FilaSolicitud {
  id: string;
  numero: string;
  estado: EstadoSolicitud;
  tipo_constancia: TipoSiniestro;
  fecha_actuacion: string; // "2026-10-11"
  hora_actuacion: string; // "18:20:00"
  domicilio_hecho: string;
  descripcion: string;
  motivo_cancelacion: string | null;
  creado_en: string;
  cancelado_en: string | null;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  domicilio: string | null;
}

const VISTA = 'solicitudes_listado';

const aSolicitud = (f: FilaSolicitud): Solicitud => ({
  id: f.id,
  numero: f.numero,
  estado: f.estado,
  fechaAlta: f.creado_en,
  damnificado: {
    nombre: f.nombre,
    apellido: f.apellido,
    dni: f.dni,
    telefono: f.telefono,
    domicilio: f.domicilio,
  },
  siniestro: {
    tipo: f.tipo_constancia,
    fechaHora: `${f.fecha_actuacion}T${f.hora_actuacion.slice(0, 5)}`,
    lugar: f.domicilio_hecho,
    descripcion: f.descripcion,
  },
  motivoCancelacion: f.motivo_cancelacion,
  canceladoEn: f.cancelado_en,
});

const columnasDamnificado = ({ damnificado: d }: DatosSolicitud) => ({
  dni: d.dni,
  nombre: d.nombre,
  apellido: d.apellido,
  telefono: d.telefono,
  domicilio: d.domicilio,
});

const columnasSiniestro = ({ siniestro: s }: DatosSolicitud) => ({
  tipo_constancia: s.tipo,
  fecha_actuacion: s.fechaHora.slice(0, 10),
  hora_actuacion: s.fechaHora.slice(11, 16),
  domicilio_hecho: s.lugar,
  descripcion: s.descripcion,
});

/**
 * Arma el filtro `or` de PostgREST para la búsqueda de US09: por número,
 * DNI o nombre del damnificado. Los valores van entre comillas para que
 * una coma o un paréntesis escrito por la persona no rompa la sintaxis.
 */
export function filtroBusqueda(busqueda: string): string | null {
  const q = busqueda.replace(/["\\%*]/g, '').trim();
  if (!q) return null;
  const digitos = q.replace(/[.\s]/g, '');
  if (/^\d+$/.test(digitos)) {
    return `dni.ilike."%${digitos}%",numero.ilike."%${digitos}%"`;
  }
  return [
    `numero.ilike."%${q}%"`,
    `nombre_completo.ilike."%${q}%"`,
    `apellido_nombre.ilike."%${q}%"`,
  ].join(',');
}

@Injectable()
export class SupabaseSolicitudRepository implements SolicitudRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  async listar(filtro: FiltroSolicitudes) {
    const or = filtro.busqueda ? filtroBusqueda(filtro.busqueda) : null;
    const consulta = (columnas: string, opciones?: { count: 'exact'; head?: boolean }) => {
      let q = this.db.from(VISTA).select(columnas, opciones);
      if (filtro.estado) q = q.eq('estado', filtro.estado);
      if (or) q = q.or(or);
      return q;
    };

    // Primero se cuenta, para no pedir un rango fuera de la última página.
    const { count, error: errorConteo } = await consulta('id', { count: 'exact', head: true });
    if (errorConteo) throw new Error(errorConteo.message);
    const total = count ?? 0;
    if (total === 0) return { items: [], total };

    const ultimaPagina = Math.ceil(total / filtro.porPagina);
    const desde = (Math.min(filtro.pagina, ultimaPagina) - 1) * filtro.porPagina;
    const ascendente = filtro.orden === 'asc';
    const { data, error } = await consulta('*')
      .order('creado_en', { ascending: ascendente })
      .order('numero', { ascending: ascendente })
      .range(desde, desde + filtro.porPagina - 1);
    if (error) throw new Error(error.message);

    return { items: (data as unknown as FilaSolicitud[]).map(aSolicitud), total };
  }

  async buscarPorId(id: string) {
    const { data, error } = await this.db.from(VISTA).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? aSolicitud(data as FilaSolicitud) : null;
  }

  async crear(datos: DatosSolicitud, creadoPor: string | null) {
    const { data: damnificado, error: errorDamnificado } = await this.db
      .from('damnificados')
      .insert([columnasDamnificado(datos)])
      .select('id')
      .single();
    if (errorDamnificado) throw new Error(errorDamnificado.message);

    const { data: constancia, error } = await this.db
      .from('constancias')
      .insert([{ ...columnasSiniestro(datos), damnificado_id: damnificado.id, creado_por: creadoPor }])
      .select('id')
      .single();
    if (error) {
      // Sin transacciones en supabase-js: se deshace el alta del damnificado a mano.
      await this.db.from('damnificados').delete().eq('id', damnificado.id);
      throw new Error(error.message);
    }

    const creada = await this.buscarPorId(constancia.id);
    if (!creada) throw new Error('No se pudo leer la solicitud recién creada');
    return creada;
  }

  async actualizarPendiente(id: string, datos: DatosSolicitud) {
    // El filtro por estado va en el mismo UPDATE: si otra persona la canceló
    // un instante antes, no se modifica nada.
    const { data, error } = await this.db
      .from('constancias')
      .update({ ...columnasSiniestro(datos), actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('damnificado_id');
    if (error) throw new Error(error.message);
    if (!data?.length) return null;

    const { error: errorDamnificado } = await this.db
      .from('damnificados')
      .update(columnasDamnificado(datos))
      .eq('id', data[0].damnificado_id);
    if (errorDamnificado) throw new Error(errorDamnificado.message);

    return this.buscarPorId(id);
  }

  async cancelarPendiente(id: string, motivo: string) {
    const ahora = new Date().toISOString();
    const { data, error } = await this.db
      .from('constancias')
      .update({ estado: 'CANCELADA', motivo_cancelacion: motivo, cancelado_en: ahora, actualizado_en: ahora })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) return null;

    return this.buscarPorId(id);
  }
}

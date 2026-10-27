import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type {
  CertificateRequestRepository,
  CertificateRequestData,
  CertificateRequestFilter,
  CompletedCertificateRequestFilter,
  DeliveryData,
} from '../domain/certificate-request.repository.js';
import type {
  CertificateRequest,
  Payment,
} from '../domain/certificate-request.entity.js';
import {
  RequestStatus,
  AccidentType,
  CertificateDestination,
  PaymentStatus,
  PaymentMethod,
} from '../domain/certificate-request.enums.js';
import { paginationRange } from '../../common/utils/pagination.utils.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';

/** Row from the public.solicitudes_listado view (constancias + damnificados). */
interface CertificateRequestRow {
  id: string;
  numero: string;
  estado: RequestStatus;
  tipo_constancia: AccidentType;
  fecha_actuacion: string; // "2026-10-11"
  hora_actuacion: string; // "18:20:00"
  domicilio_hecho: string;
  parte_numero: string | null;
  localidad: string | null;
  partido: string | null;
  motivo: string | null;
  perdidas: string | null;
  destino: CertificateDestination | null;
  razon_social: string | null;
  numero_poliza: string | null;
  patente_vehiculo: string | null;
  observaciones: string | null;
  estado_arancel: PaymentStatus;
  monto: number | null;
  metodo_pago: PaymentMethod | null;
  motivo_exento: string | null;
  fecha_pago: string | null;
  motivo_cancelacion: string | null;
  creado_en: string;
  cancelado_en: string | null;
  retirado_en: string | null;
  retirado_por_nombre: string | null;
  retirado_por_dni: string | null;
  dni: string;
  nombre: string;
  telefono: string | null;
}

/** Snapshot of constancia columns used to compensate a failed victim update. */
interface CertificateSnapshot {
  damnificado_id: string;
  tipo_constancia: AccidentType;
  fecha_actuacion: string;
  hora_actuacion: string;
  domicilio_hecho: string;
  parte_numero: string | null;
  localidad: string | null;
  partido: string | null;
  motivo: string | null;
  perdidas: string | null;
  destino: CertificateDestination | null;
  razon_social: string | null;
  numero_poliza: string | null;
  patente_vehiculo: string | null;
}

/** Maps domain victim fields to the damnificados table columns. */
const victimColumns = ({ damnificado: d }: CertificateRequestData) => ({
  dni: d.dni,
  nombre: d.nombre,
  telefono: d.telefono,
});

/** Maps domain accident + certificate fields to the constancias table columns. */
const certificateColumns = ({
  siniestro: s,
  constancia: c,
}: CertificateRequestData) => ({
  tipo_constancia: s.tipo,
  fecha_actuacion: s.fecha,
  hora_actuacion: s.hora,
  domicilio_hecho: s.direccion,
  parte_numero: s.numeroParte,
  localidad: s.localidad,
  partido: s.partido,
  motivo: s.motivo,
  perdidas: s.perdidas,
  patente_vehiculo: s.patenteVehiculo,
  destino: c.destino,
  razon_social: c.razonSocial,
  numero_poliza: c.numeroPoliza,
});

/**
 * Builds the PostgREST `or` filter for US09 search: by number, DNI or victim name.
 * Values are quoted so a comma or parenthesis typed by the user does not break syntax.
 */
export function buildSearchFilter(busqueda: string): string | null {
  const q = busqueda.replace(/["\\%*]/g, '').trim();
  if (!q) return null;
  const digits = q.replace(/[.\s]/g, '');
  if (/^\d+$/.test(digits)) {
    return `dni.ilike."%${digits}%",numero.ilike."%${digits}%"`;
  }
  return [`numero.ilike."%${q}%"`, `nombre.ilike."%${q}%"`].join(',');
}

/** Supabase implementation of CertificateRequestRepository. */
@Injectable()
export class SupabaseCertificateRequestRepository implements CertificateRequestRepository {
  /** Public view joining constancias and damnificados. */
  private readonly LIST_VIEW = 'solicitudes_listado';

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  /**
   * Lists active requests: never includes RETIRADA.
   * Optional search/status filter, sort by created date, and pagination.
   */
  public async findAll(filter: CertificateRequestFilter) {
    return this.listFromView({
      busqueda: filter.busqueda,
      orden: filter.orden,
      pagina: filter.pagina,
      porPagina: filter.porPagina,
      estado: filter.estado,
      completedOnly: false,
    });
  }

  /**
   * Lists completed requests (RETIRADA only).
   * Optional search, sort by created date, and pagination.
   */
  public async findCompleted(filter: CompletedCertificateRequestFilter) {
    return this.listFromView({
      busqueda: filter.busqueda,
      orden: filter.orden,
      pagina: filter.pagina,
      porPagina: filter.porPagina,
      completedOnly: true,
    });
  }

  /**
   * Shared list query: count → range, search, order by creado_en + numero.
   * Active list excludes RETIRADA; completed list is RETIRADA only.
   */
  private async listFromView(options: {
    busqueda?: string;
    orden: 'asc' | 'desc';
    pagina: number;
    porPagina: number;
    estado?: RequestStatus;
    completedOnly: boolean;
  }) {
    const or = options.busqueda ? buildSearchFilter(options.busqueda) : null;
    const query = (
      columns: string,
      selectOptions?: { count: 'exact'; head?: boolean },
    ) => {
      let q = this.db.from(this.LIST_VIEW).select(columns, selectOptions);
      if (options.completedOnly) {
        q = q.eq('estado', 'RETIRADA');
      } else {
        q = q.neq('estado', 'RETIRADA');
        if (options.estado) q = q.eq('estado', options.estado);
      }
      if (or) q = q.or(or);
      return q;
    };

    // Count first so we never request a range past the last page.
    const { count, error: countError } = await query('id', {
      count: 'exact',
      head: true,
    });
    if (countError) throwMappedSupabaseError(countError);
    const total = count ?? 0;
    if (total === 0) return { items: [], total };

    const { from, to } = paginationRange(
      options.pagina,
      options.porPagina,
      total,
    );
    const ascending = options.orden === 'asc';
    const { data, error } = await query('*')
      .order('creado_en', { ascending })
      .order('numero', { ascending })
      .range(from, to);
    if (error) throwMappedSupabaseError(error);

    return {
      items: (data as unknown as CertificateRequestRow[]).map((row) =>
        this.toCertificateRequest(row),
      ),
      total,
    };
  }

  /** Returns the request or null if it does not exist. */
  public async findById(id: string) {
    const { data, error } = await this.db
      .from(this.LIST_VIEW)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    return data
      ? this.toCertificateRequest(data as CertificateRequestRow)
      : null;
  }

  /** Creates damnificado + constancia; rolls back the victim if constancia insert fails. */
  public async create(data: CertificateRequestData, createdBy: string | null) {
    const { data: victim, error: victimError } = await this.db
      .from('damnificados')
      .insert([victimColumns(data)])
      .select('id')
      .single();
    if (victimError) throwMappedSupabaseError(victimError);

    const { data: certificate, error } = await this.db
      .from('constancias')
      .insert([
        {
          ...certificateColumns(data),
          damnificado_id: victim.id,
          creado_por: createdBy,
        },
      ])
      .select('id')
      .single();
    if (error) {
      // No transactions in supabase-js: undo the victim insert by hand.
      await this.db.from('damnificados').delete().eq('id', victim.id);
      throwMappedSupabaseError(error);
    }

    const created = await this.findById(certificate.id);
    if (!created) {
      throwMappedSupabaseError({
        message: 'No se pudo leer la solicitud recién creada',
      });
    }
    return created;
  }

  /** Updates only if still PENDIENTE; compensates constancia if victim update fails. */
  public async updatePending(id: string, data: CertificateRequestData) {
    // Prior snapshot to compensate if the victim update fails.
    const { data: prev, error: prevError } = await this.db
      .from('constancias')
      .select(
        'damnificado_id, tipo_constancia, fecha_actuacion, hora_actuacion, domicilio_hecho, parte_numero, localidad, partido, motivo, perdidas, destino, razon_social, numero_poliza, patente_vehiculo',
      )
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .maybeSingle();
    if (prevError) throwMappedSupabaseError(prevError);
    if (!prev) return null;

    const snapshot = prev as CertificateSnapshot;

    // Status filter is on the same UPDATE: if someone cancelled an instant earlier, nothing changes.
    const { data: rows, error } = await this.db
      .from('constancias')
      .update({
        ...certificateColumns(data),
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('damnificado_id');
    if (error) throwMappedSupabaseError(error);
    if (!rows?.length) return null;

    const { error: victimError } = await this.db
      .from('damnificados')
      .update(victimColumns(data))
      .eq('id', rows[0].damnificado_id);
    if (victimError) {
      await this.db
        .from('constancias')
        .update({
          tipo_constancia: snapshot.tipo_constancia,
          fecha_actuacion: snapshot.fecha_actuacion,
          hora_actuacion: snapshot.hora_actuacion,
          domicilio_hecho: snapshot.domicilio_hecho,
          parte_numero: snapshot.parte_numero,
          localidad: snapshot.localidad,
          partido: snapshot.partido,
          motivo: snapshot.motivo,
          perdidas: snapshot.perdidas,
          destino: snapshot.destino,
          razon_social: snapshot.razon_social,
          numero_poliza: snapshot.numero_poliza,
          patente_vehiculo: snapshot.patente_vehiculo,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id);
      throwMappedSupabaseError(victimError);
    }

    return this.findById(id);
  }

  /** Cancels only if still PENDIENTE; returns null otherwise. */
  public async cancelPending(id: string, reason: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('constancias')
      .update({
        estado: 'CANCELADA',
        motivo_cancelacion: reason,
        cancelado_en: now,
        actualizado_en: now,
      })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id');
    if (error) throwMappedSupabaseError(error);
    if (!data?.length) return null;

    return this.findById(id);
  }

  /** Marks as REALIZADA only if still PENDIENTE (PENDIENTE → REALIZADA). */
  public async markAsRealized(id: string, observations: string | null) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('constancias')
      .update({
        estado: 'REALIZADA',
        observaciones: observations,
        actualizado_en: now,
      })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id');
    if (error) throwMappedSupabaseError(error);
    if (!data?.length) return false;
    return true;
  }

  /** Signs only if the request is REALIZADA (REALIZADA → FIRMADA). */
  public async signRequest(id: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('constancias')
      .update({
        estado: 'FIRMADA',
        firmado_en: now,
        actualizado_en: now,
      })
      .eq('id', id)
      .eq('estado', 'REALIZADA')
      .select('id');
    if (error) throwMappedSupabaseError(error);
    if (!data?.length) return false;
    return true;
  }

  /** Delivers only if FIRMADA and fee is ABONADO or EXENTO (RN/02). */
  public async markAsDelivered(id: string, data: DeliveryData) {
    const now = new Date().toISOString();
    const { data: rows, error } = await this.db
      .from('constancias')
      .update({
        estado: 'RETIRADA',
        actualizado_en: now,
        retirado_en: now,
        retirado_por_nombre: data.nombreCompleto,
        retirado_por_dni: data.dni,
      })
      .eq('id', id)
      .eq('estado', 'FIRMADA')
      .in('estado_arancel', ['ABONADO', 'EXENTO'])
      .select('id');
    if (error) throwMappedSupabaseError(error);
    if (!rows?.length) return null;
    return this.findById(id);
  }

  /** Registers or edits payment if the request is not cancelled or delivered. */
  public async addPayment(id: string, payment: Payment) {
    const { data, error } = await this.db
      .from('constancias')
      .update({
        estado_arancel: payment.estado,
        monto: payment.monto,
        metodo_pago: payment.metodoPago,
        motivo_exento: payment.motivoExento,
        fecha_pago: payment.fechaPago,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .not('estado', 'in', '(CANCELADA,RETIRADA)')
      .select('id');
    if (error) throwMappedSupabaseError(error);
    if (!data?.length) return null;
    return this.findById(id);
  }

  /** Maps a list-view row to the CertificateRequest domain shape. */
  private toCertificateRequest(row: CertificateRequestRow): CertificateRequest {
    return {
      id: row.id,
      numero: row.numero,
      estado: row.estado,
      fechaAlta: row.creado_en,
      damnificado: {
        nombre: row.nombre,
        dni: row.dni,
        telefono: row.telefono,
      },
      siniestro: {
        tipo: row.tipo_constancia,
        fecha: row.fecha_actuacion,
        hora: row.hora_actuacion.slice(0, 5),
        direccion: row.domicilio_hecho,
        numeroParte: row.parte_numero ?? '',
        motivo: row.motivo ?? '',
        localidad: row.localidad ?? '',
        partido: row.partido ?? '',
        perdidas: row.perdidas ?? '',
        patenteVehiculo: row.patente_vehiculo,
      },
      constancia: {
        destino: row.destino ?? 'ACCION_SOCIAL',
        razonSocial: row.razon_social ?? '',
        numeroPoliza: row.numero_poliza,
      },
      abono:
        row.estado_arancel === 'PENDIENTE'
          ? null
          : {
              estado: row.estado_arancel,
              monto: row.monto == null ? null : Number(row.monto),
              metodoPago: row.metodo_pago,
              fechaPago: row.fecha_pago ?? row.creado_en,
              motivoExento: row.motivo_exento,
            },
      observaciones: row.observaciones,
      motivoCancelacion: row.motivo_cancelacion,
      canceladoEn: row.cancelado_en,
      retiradoEn: row.retirado_en,
      retiradoPorNombre: row.retirado_por_nombre,
      retiradoPorDni: row.retirado_por_dni,
    };
  }
}

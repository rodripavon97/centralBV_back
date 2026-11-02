import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import { paginationRange } from '../../common/utils/pagination.utils.js';
import { fieldError } from '../../common/utils/field-error.js';
import type {
  RevisionData,
  RevisionRepository,
} from '../domain/revision.repository.js';
import type {
  ItemRevision,
  Revision,
  RevisionItems,
} from '../domain/revision.entity.js';
import {
  REVISION_ERROR_CODES,
  REVISION_ITEM_KEYS,
} from '../domain/revision.enums.js';

interface RevisionRow {
  id: string;
  vehiculo_id: string;
  items: RevisionItems;
  comentario_general: string | null;
  creado_en: string;
  autor: { id: string; nombre: string; apellido: string | null } | null;
}

const TABLE = 'revisiones_vehiculo';
/** El autor sale de usuarios por la FK revisado_por. */
const SELECT =
  'id, vehiculo_id, items, comentario_general, creado_en, autor:usuarios!revisiones_vehiculo_revisado_por_fkey(id, nombre, apellido)';

/** Traduce los RAISE EXCEPTION de registrar_revision_vehiculo a errores HTTP. */
export function throwRevisionRpcError(error: {
  message?: string;
  code?: string;
}): never {
  const message = error.message ?? '';
  if (message.includes('VEHICULO_NO_EXISTE')) {
    throw new NotFoundException('El vehículo de emergencia no existe');
  }
  if (message.includes('VEHICULO_DADO_DE_BAJA')) {
    throw new ConflictException('El vehículo ya está dado de baja definitiva');
  }
  if (message.includes('COMENTARIO_OBLIGATORIO')) {
    throw new BadRequestException(
      fieldError(
        'comentarioGeneral',
        REVISION_ERROR_CODES.maintenanceCommentRequired,
        'El móvil estaba en mantenimiento: contá qué se hizo en el comentario general',
      ),
    );
  }
  throwMappedSupabaseError(error);
}

/** Supabase adapter for vehicle inspections. */
@Injectable()
export class SupabaseRevisionRepository implements RevisionRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private mapRow(row: RevisionRow): Revision {
    const items = this.normalizeItems(row.items);
    const autor = row.autor;
    return {
      id: row.id,
      vehiculoId: row.vehiculo_id,
      ...items,
      comentarioGeneral: row.comentario_general,
      revisadoPor: autor
        ? {
            id: autor.id,
            nombre: [autor.nombre, autor.apellido]
              .filter((parte) => parte?.trim())
              .join(' '),
          }
        : null,
      creadoEn: row.creado_en,
    };
  }

  private normalizeItems(raw: RevisionItems): RevisionItems {
    const items = {} as RevisionItems;
    for (const key of REVISION_ITEM_KEYS) {
      const item = raw?.[key] as ItemRevision | undefined;
      items[key] = {
        estado: item?.estado ?? 'OK',
        comentario: item?.comentario ?? null,
      };
    }
    return items;
  }

  async create(data: RevisionData): Promise<Revision> {
    // Revisión + estado del móvil en una transacción (función de fleet.sql).
    const { data: id, error } = await this.db.rpc(
      'registrar_revision_vehiculo',
      {
        p_vehiculo_id: data.vehiculoId,
        p_items: data.items,
        p_comentario_general: data.comentarioGeneral,
        p_revisado_por: data.revisadoPor,
        p_estado_nuevo: data.estadoNuevo,
      },
    );
    if (error) throwRevisionRpcError(error);

    const revision = await this.findById(data.vehiculoId, id as string);
    if (!revision) {
      throw new NotFoundException('No se encontró la revisión recién guardada');
    }
    return revision;
  }

  async findLatestByVehicleId(vehiculoId: string): Promise<Revision | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT)
      .eq('vehiculo_id', vehiculoId)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) return null;
    return this.mapRow(data as unknown as RevisionRow);
  }

  async findByVehicleId(
    vehiculoId: string,
    pagina: number,
    porPagina: number,
  ): Promise<{ items: Revision[]; total: number }> {
    const { count, error: countError } = await this.db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('vehiculo_id', vehiculoId);
    if (countError) throwMappedSupabaseError(countError);
    const total = count ?? 0;
    if (total === 0) return { items: [], total };

    const { from, to } = paginationRange(pagina, porPagina, total);
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT)
      .eq('vehiculo_id', vehiculoId)
      .order('creado_en', { ascending: false })
      .range(from, to);
    if (error) throwMappedSupabaseError(error);
    return {
      items: (data as unknown as RevisionRow[]).map((row) => this.mapRow(row)),
      total,
    };
  }

  async findById(
    vehiculoId: string,
    revisionId: string,
  ): Promise<Revision | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT)
      .eq('id', revisionId)
      .eq('vehiculo_id', vehiculoId)
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) return null;
    return this.mapRow(data as unknown as RevisionRow);
  }
}

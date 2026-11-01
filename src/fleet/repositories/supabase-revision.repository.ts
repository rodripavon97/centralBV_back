import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import type {
  RevisionData,
  RevisionRepository,
} from '../domain/revision.repository.js';
import type {
  ItemRevision,
  Revision,
  RevisionItems,
} from '../domain/revision.entity.js';
import { REVISION_ITEM_KEYS } from '../domain/revision.enums.js';

interface RevisionRow {
  id: string;
  vehiculo_id: string;
  items: RevisionItems;
  comentario_general: string | null;
  creado_en: string;
}

const TABLE = 'revisiones_vehiculo';
const SELECT = 'id, vehiculo_id, items, comentario_general, creado_en';

/** Supabase adapter for vehicle inspections. */
@Injectable()
export class SupabaseRevisionRepository implements RevisionRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private mapRow(row: RevisionRow): Revision {
    const items = this.normalizeItems(row.items);
    return {
      id: row.id,
      vehiculoId: row.vehiculo_id,
      ...items,
      comentarioGeneral: row.comentario_general,
      creadoEn: row.creado_en,
    };
  }

  private normalizeItems(raw: RevisionItems): RevisionItems {
    const items = {} as RevisionItems;
    for (const key of REVISION_ITEM_KEYS) {
      const item = raw[key] as ItemRevision | undefined;
      items[key] = {
        estado: item?.estado ?? 'OK',
        comentario: item?.comentario ?? null,
      };
    }
    return items;
  }

  async create(data: RevisionData): Promise<Revision> {
    const { data: row, error } = await this.db
      .from(TABLE)
      .insert({
        vehiculo_id: data.vehiculoId,
        items: data.items,
        comentario_general: data.comentarioGeneral,
      })
      .select(SELECT)
      .single();
    if (error) throwMappedSupabaseError(error);
    return this.mapRow(row as RevisionRow);
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
    return this.mapRow(data as RevisionRow);
  }
}

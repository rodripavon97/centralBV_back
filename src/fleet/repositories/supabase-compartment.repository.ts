import { ConflictException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import { fieldError } from '../../common/utils/field-error.js';
import type {
  Compartment,
  CompartmentDraft,
} from '../domain/compartment.entity.js';
import {
  CompartmentInUseError,
  type CompartmentChanges,
  type CompartmentRepository,
} from '../domain/compartment.repository.js';
import {
  COMPARTMENT_ERROR_CODES,
  type CompartmentStatus,
  type CompartmentZone,
} from '../domain/compartment.enums.js';
import { sortCompartments } from '../domain/compartment-plan.js';

interface CompartmentRow {
  id: string;
  vehiculo_id: string;
  zona: CompartmentZone;
  nombre: string;
  orden: number;
  estado: CompartmentStatus;
  creado_en: string;
  actualizado_en: string;
}

const TABLE = 'compartimentos_vehiculo';
const SELECT =
  'id, vehiculo_id, zona, nombre, orden, estado, creado_en, actualizado_en';

export const DUPLICATE_NAME_MESSAGE = 'Ya existe un buche con ese nombre';

/** 23505 on the per-vehicle name index → 409 on the `nombre` field. */
function throwCompartmentWriteError(error: {
  code?: string;
  message?: string;
  details?: string;
}): never {
  if (error.code === '23505') {
    throw new ConflictException(
      fieldError(
        'nombre',
        COMPARTMENT_ERROR_CODES.duplicateName,
        DUPLICATE_NAME_MESSAGE,
      ),
    );
  }
  throwMappedSupabaseError(error);
}

/** Supabase adapter for vehicle compartments. */
@Injectable()
export class SupabaseCompartmentRepository implements CompartmentRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private mapRow(row: CompartmentRow): Compartment {
    return {
      id: row.id,
      vehiculoId: row.vehiculo_id,
      zona: row.zona,
      nombre: row.nombre,
      orden: row.orden,
      estado: row.estado,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    };
  }

  async findByVehicleId(vehiculoId: string): Promise<Compartment[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT)
      .eq('vehiculo_id', vehiculoId);
    if (error) throwMappedSupabaseError(error);
    // Zone order is the plan's, not the enum's alphabetical one.
    return sortCompartments(
      ((data ?? []) as CompartmentRow[]).map((row) => this.mapRow(row)),
    );
  }

  async findById(vehiculoId: string, id: string): Promise<Compartment | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select(SELECT)
      .eq('id', id)
      .eq('vehiculo_id', vehiculoId)
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    return data ? this.mapRow(data as CompartmentRow) : null;
  }

  async createMany(
    vehiculoId: string,
    drafts: CompartmentDraft[],
  ): Promise<Compartment[]> {
    // One insert = one statement: all of them or none.
    const { data, error } = await this.db
      .from(TABLE)
      .insert(
        drafts.map((d) => ({
          vehiculo_id: vehiculoId,
          zona: d.zona,
          nombre: d.nombre,
          orden: d.orden,
        })),
      )
      .select(SELECT);
    if (error) throwCompartmentWriteError(error);
    return sortCompartments(
      ((data ?? []) as CompartmentRow[]).map((row) => this.mapRow(row)),
    );
  }

  async update(
    vehiculoId: string,
    id: string,
    changes: CompartmentChanges,
  ): Promise<Compartment | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .update({ ...changes, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('vehiculo_id', vehiculoId)
      .select(SELECT)
      .maybeSingle();
    if (error) throwCompartmentWriteError(error);
    return data ? this.mapRow(data as CompartmentRow) : null;
  }

  async delete(vehiculoId: string, id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('vehiculo_id', vehiculoId)
      .select('id');
    if (error) {
      // Materials (later) reference the compartment with ON DELETE RESTRICT.
      if (error.code === '23503') throw new CompartmentInUseError();
      throwMappedSupabaseError(error);
    }
    return (data ?? []).length > 0;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import { paginationRange } from '../../common/utils/pagination.utils.js';
import type {
  EmergencyVehicleData,
  EmergencyVehicleFilter,
  EmergencyVehicleRepository,
} from '../domain/emergency-vehicle.repository.js';
import type { EmergencyVehicle } from '../domain/emergency-vehicle.entity.js';
import type { EmergencyVehicleStatus } from '../domain/emergency-vehicle.enums.js';

/** Row from vehiculos_emergencia_listado (vehicle + catalog labels). */
interface EmergencyVehicleListRow {
  id: string;
  estado: EmergencyVehicleStatus;
  patente: string;
  denominacion: string;
  motivo_baja: string | null;
  tipo_id: string;
  tipo_valor: string;
  marca_id: string;
  marca_valor: string;
  modelo_id: string;
  modelo_valor: string;
}

const LIST_VIEW = 'vehiculos_emergencia_listado';
const LIST_SELECT =
  'id, estado, patente, denominacion, motivo_baja, tipo_id, tipo_valor, marca_id, marca_valor, modelo_id, modelo_valor';

/**
 * Builds the PostgREST `or` filter for search by denomination or plate.
 * Values are quoted so commas/parentheses do not break syntax.
 */
export function buildVehicleSearchFilter(busqueda: string): string | null {
  const q = busqueda.replace(/["\\%*]/g, '').trim();
  if (!q) return null;
  return `denominacion.ilike."%${q}%",patente.ilike."%${q}%"`;
}

/** Supabase adapter for emergency vehicles. */
@Injectable()
export class SupabaseEmergencyVehicleRepository
  implements EmergencyVehicleRepository
{
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private mapListRow(row: EmergencyVehicleListRow): EmergencyVehicle {
    return {
      id: row.id,
      estado: row.estado,
      patente: row.patente,
      denominacion: row.denominacion,
      tipo: { id: row.tipo_id, valor: row.tipo_valor },
      marca: { id: row.marca_id, valor: row.marca_valor },
      modelo: {
        id: row.modelo_id,
        valor: row.modelo_valor,
        marcaId: row.marca_id,
      },
      motivoBaja: row.motivo_baja,
    };
  }

  private toColumns(data: EmergencyVehicleData) {
    return {
      patente: data.patente,
      denominacion: data.denominacion,
      tipo_id: data.tipoId,
      marca_id: data.marcaId,
      modelo_id: data.modeloId,
    };
  }

  async findAll(
    filter: EmergencyVehicleFilter,
  ): Promise<{ items: EmergencyVehicle[]; total: number }> {
    const or = filter.busqueda
      ? buildVehicleSearchFilter(filter.busqueda)
      : null;

    const query = (
      columns: string,
      selectOptions?: { count: 'exact'; head?: boolean },
    ) => {
      let q = this.db
        .from(LIST_VIEW)
        .select(columns, selectOptions)
        .neq('estado', 'BAJA_DEFINITIVA');
      if (filter.estado) q = q.eq('estado', filter.estado);
      if (filter.tipoId != null) q = q.eq('tipo_id', filter.tipoId);
      if (or) q = q.or(or);
      return q;
    };

    const { count, error: countError } = await query('id', {
      count: 'exact',
      head: true,
    });
    if (countError) throwMappedSupabaseError(countError);
    const total = count ?? 0;
    if (total === 0) return { items: [], total };

    const { from, to } = paginationRange(
      filter.pagina,
      filter.porPagina,
      total,
    );
    const ascending = filter.orden === 'asc';
    const { data, error } = await query(LIST_SELECT)
      .order(filter.ordenPor, { ascending })
      .range(from, to);
    if (error) throwMappedSupabaseError(error);

    return {
      items: (data as unknown as EmergencyVehicleListRow[]).map((row) =>
        this.mapListRow(row),
      ),
      total,
    };
  }

  async findById(id: string): Promise<EmergencyVehicle | null> {
    const { data, error } = await this.db
      .from(LIST_VIEW)
      .select(LIST_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) return null;
    return this.mapListRow(data as EmergencyVehicleListRow);
  }

  async create(data: EmergencyVehicleData): Promise<EmergencyVehicle> {
    const { data: row, error } = await this.db
      .from('vehiculos_emergencia')
      .insert({
        ...this.toColumns(data),
        estado: 'OPERATIVO',
        motivo_baja: null,
      })
      .select('id')
      .single();
    if (error) throwMappedSupabaseError(error);
    const created = await this.findById((row as { id: string }).id);
    if (!created) {
      throw new NotFoundException('El vehículo de emergencia no existe');
    }
    return created;
  }

  async update(
    id: string,
    data: EmergencyVehicleData,
  ): Promise<EmergencyVehicle | null> {
    const { data: row, error } = await this.db
      .from('vehiculos_emergencia')
      .update(this.toColumns(data))
      .eq('id', id)
      .neq('estado', 'BAJA_DEFINITIVA')
      .select('id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!row) return null;
    return this.findById(id);
  }

  async markAsWrittenOff(
    id: string,
    motivo: string,
  ): Promise<EmergencyVehicle | null> {
    const { data: row, error } = await this.db
      .from('vehiculos_emergencia')
      .update({ estado: 'BAJA_DEFINITIVA', motivo_baja: motivo })
      .eq('id', id)
      .neq('estado', 'BAJA_DEFINITIVA')
      .select('id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!row) return null;
    return this.findById(id);
  }

  async existsByType(typeId: string): Promise<boolean> {
    return this.existsByColumn('tipo_id', typeId);
  }

  async existsByBrand(brandId: string): Promise<boolean> {
    return this.existsByColumn('marca_id', brandId);
  }

  async existsByModel(modelId: string): Promise<boolean> {
    return this.existsByColumn('modelo_id', modelId);
  }

  private async existsByColumn(
    column: 'tipo_id' | 'marca_id' | 'modelo_id',
    value: string,
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from('vehiculos_emergencia')
      .select('id')
      .eq(column, value)
      .limit(1);
    if (error) throwMappedSupabaseError(error);
    return (data?.length ?? 0) > 0;
  }
}

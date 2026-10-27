import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { throwMappedSupabaseError } from '../../supabase/supabase-error.js';
import type { VehicleCatalogRepository } from '../domain/vehicle-catalog.repository.js';
import type {
  EmergencyVehicleBrand,
  EmergencyVehicleModel,
  EmergencyVehicleType,
} from '../domain/vehicle-catalog.entity.js';

interface CatalogNameRow {
  id: string;
  valor: string;
}

interface ModelRow extends CatalogNameRow {
  marca_id: string;
}

const NOT_FOUND = {
  type: 'El tipo de vehículo no existe o está desactivado',
  brand: 'La marca no existe o está desactivada',
  model: 'El modelo no existe o está desactivado',
} as const;

/** Supabase implementation of vehicle catalog persistence. */
@Injectable()
export class SupabaseVehicleCatalogRepository implements VehicleCatalogRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private mapNamed({ id, valor }: CatalogNameRow): EmergencyVehicleType {
    return { id, valor };
  }

  private mapModel({ id, valor, marca_id }: ModelRow): EmergencyVehicleModel {
    return { id, valor, marcaId: marca_id };
  }

  async findTypes(): Promise<EmergencyVehicleType[]> {
    const { data, error } = await this.db
      .from('tipos_vehiculo')
      .select('id, valor')
      .eq('activo', true)
      .order('valor');
    if (error) throwMappedSupabaseError(error);
    return (data ?? []).map((row) => this.mapNamed(row as CatalogNameRow));
  }

  async createType(name: string): Promise<EmergencyVehicleType> {
    const { data, error } = await this.db
      .from('tipos_vehiculo')
      .insert({ valor: name, activo: true })
      .select('id, valor')
      .single();
    if (error) throwMappedSupabaseError(error);
    return this.mapNamed(data as CatalogNameRow);
  }

  async updateType(id: string, name: string): Promise<EmergencyVehicleType> {
    const { data, error } = await this.db
      .from('tipos_vehiculo')
      .update({ valor: name })
      .eq('id', id)
      .eq('activo', true)
      .select('id, valor')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.type);
    return this.mapNamed(data as CatalogNameRow);
  }

  async deactivateType(id: string): Promise<void> {
    const { data, error } = await this.db
      .from('tipos_vehiculo')
      .update({ activo: false })
      .eq('id', id)
      .eq('activo', true)
      .select('id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.type);
  }

  async findBrands(): Promise<EmergencyVehicleBrand[]> {
    const { data, error } = await this.db
      .from('marcas_vehiculo')
      .select('id, valor')
      .eq('activo', true)
      .order('valor');
    if (error) throwMappedSupabaseError(error);
    return (data ?? []).map((row) => this.mapNamed(row as CatalogNameRow));
  }

  async createBrand(name: string): Promise<EmergencyVehicleBrand> {
    const { data, error } = await this.db
      .from('marcas_vehiculo')
      .insert({ valor: name, activo: true })
      .select('id, valor')
      .single();
    if (error) throwMappedSupabaseError(error);
    return this.mapNamed(data as CatalogNameRow);
  }

  async updateBrand(id: string, name: string): Promise<EmergencyVehicleBrand> {
    const { data, error } = await this.db
      .from('marcas_vehiculo')
      .update({ valor: name })
      .eq('id', id)
      .eq('activo', true)
      .select('id, valor')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.brand);
    return this.mapNamed(data as CatalogNameRow);
  }

  async deactivateBrand(id: string): Promise<void> {
    const { data, error } = await this.db
      .from('marcas_vehiculo')
      .update({ activo: false })
      .eq('id', id)
      .eq('activo', true)
      .select('id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.brand);
  }

  async findModels(): Promise<EmergencyVehicleModel[]> {
    const { data, error } = await this.db
      .from('modelos_vehiculo')
      .select('id, valor, marca_id')
      .eq('activo', true)
      .order('valor');
    if (error) throwMappedSupabaseError(error);
    return (data ?? []).map((row) => this.mapModel(row as ModelRow));
  }

  async createModel(
    name: string,
    brandId: string,
  ): Promise<EmergencyVehicleModel> {
    const { data, error } = await this.db
      .from('modelos_vehiculo')
      .insert({ valor: name, marca_id: brandId, activo: true })
      .select('id, valor, marca_id')
      .single();
    if (error) throwMappedSupabaseError(error);
    return this.mapModel(data as ModelRow);
  }

  async updateModel(id: string, name: string): Promise<EmergencyVehicleModel> {
    const { data, error } = await this.db
      .from('modelos_vehiculo')
      .update({ valor: name })
      .eq('id', id)
      .eq('activo', true)
      .select('id, valor, marca_id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.model);
    return this.mapModel(data as ModelRow);
  }

  async deactivateModel(id: string): Promise<void> {
    const { data, error } = await this.db
      .from('modelos_vehiculo')
      .update({ activo: false })
      .eq('id', id)
      .eq('activo', true)
      .select('id')
      .maybeSingle();
    if (error) throwMappedSupabaseError(error);
    if (!data) throw new NotFoundException(NOT_FOUND.model);
  }
}

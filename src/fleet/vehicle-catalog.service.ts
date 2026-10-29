import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  VEHICLE_CATALOG_REPOSITORY,
  type VehicleCatalogRepository,
} from './domain/vehicle-catalog.repository.js';
import {
  EMERGENCY_VEHICLE_REPOSITORY,
  type CatalogColumn,
  type EmergencyVehicleRepository,
} from './domain/emergency-vehicle.repository.js';
import type {
  CatalogItemWithUsage,
  EmergencyVehicleBrand,
  EmergencyVehicleModel,
  EmergencyVehicleType,
} from './domain/vehicle-catalog.entity.js';

const EMPTY_NAME = 'El nombre no puede estar vacío';
/** Cuántas denominaciones se listan en el mensaje de "en uso". */
const MAX_LISTED_VEHICLES = 3;

const DUPLICATE = {
  type: 'Ya existe un tipo con ese nombre',
  brand: 'Ya existe una marca con ese nombre',
  model: 'Ya existe un modelo con ese nombre para esa marca',
} as const;

/** Compara nombres sin importar mayúsculas, acentos ni espacios repetidos. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

/**
 * "No se puede eliminar Ford: la usa 1 móvil (M-1)."
 * "No se puede eliminar Ford: la usan 5 móviles (M-1, M-2, M-3 y 2 más)."
 */
export function inUseMessage(name: string, denominations: string[]): string {
  const total = denominations.length;
  const listed = denominations.slice(0, MAX_LISTED_VEHICLES).join(', ');
  const rest = total - MAX_LISTED_VEHICLES;
  const who = rest > 0 ? `${listed} y ${rest} más` : listed;
  const verb = total === 1 ? 'la usa 1 móvil' : `la usan ${total} móviles`;
  return `No se puede eliminar ${name}: ${verb} (${who}).`;
}

/** Application rules for vehicle type, brand and model catalogs. */
@Injectable()
export class VehicleCatalogService {
  constructor(
    @Inject(VEHICLE_CATALOG_REPOSITORY)
    private readonly catalog: VehicleCatalogRepository,
    @Inject(EMERGENCY_VEHICLE_REPOSITORY)
    private readonly vehicles: EmergencyVehicleRepository,
  ) {}

  private requireName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new BadRequestException(EMPTY_NAME);
    return trimmed;
  }

  /** Rejects a name already used by another active entry of the same list. */
  private assertUniqueName(
    items: { id: string; valor: string }[],
    name: string,
    message: string,
    exceptId?: string,
  ): void {
    if (items.some((i) => i.id !== exceptId && sameName(i.valor, name))) {
      throw new ConflictException(message);
    }
  }

  /** Blocks deactivation while active vehicles use the entry. */
  private async assertNotInUse(
    column: CatalogColumn,
    id: string,
    items: { id: string; valor: string }[],
  ): Promise<void> {
    const denominations = await this.vehicles.findActiveDenominationsByCatalog(
      column,
      id,
    );
    if (denominations.length === 0) return;
    const name = items.find((i) => i.id === id)?.valor ?? 'este ítem';
    throw new ConflictException(inUseMessage(name, denominations));
  }

  private withUsage<T extends { id: string }>(
    items: T[],
    usage: Record<string, number>,
  ): CatalogItemWithUsage<T>[] {
    return items.map((item) => ({ ...item, enUso: usage[item.id] ?? 0 }));
  }

  // --- tipos ---

  async findTypes(): Promise<CatalogItemWithUsage<EmergencyVehicleType>[]> {
    const [types, usage] = await Promise.all([
      this.catalog.findTypes(),
      this.vehicles.countActiveByCatalog(),
    ]);
    return this.withUsage(types, usage.tipos);
  }

  async createType(name: string): Promise<EmergencyVehicleType> {
    const valor = this.requireName(name);
    this.assertUniqueName(
      await this.catalog.findTypes(),
      valor,
      DUPLICATE.type,
    );
    return this.catalog.createType(valor);
  }

  async updateType(id: string, name: string): Promise<EmergencyVehicleType> {
    const valor = this.requireName(name);
    this.assertUniqueName(
      await this.catalog.findTypes(),
      valor,
      DUPLICATE.type,
      id,
    );
    return this.catalog.updateType(id, valor);
  }

  async deactivateType(id: string): Promise<void> {
    await this.assertNotInUse('tipo_id', id, await this.catalog.findTypes());
    await this.catalog.deactivateType(id);
  }

  // --- marcas ---

  async findBrands(): Promise<CatalogItemWithUsage<EmergencyVehicleBrand>[]> {
    const [brands, usage] = await Promise.all([
      this.catalog.findBrands(),
      this.vehicles.countActiveByCatalog(),
    ]);
    return this.withUsage(brands, usage.marcas);
  }

  async createBrand(name: string): Promise<EmergencyVehicleBrand> {
    const valor = this.requireName(name);
    this.assertUniqueName(
      await this.catalog.findBrands(),
      valor,
      DUPLICATE.brand,
    );
    return this.catalog.createBrand(valor);
  }

  async updateBrand(id: string, name: string): Promise<EmergencyVehicleBrand> {
    const valor = this.requireName(name);
    this.assertUniqueName(
      await this.catalog.findBrands(),
      valor,
      DUPLICATE.brand,
      id,
    );
    return this.catalog.updateBrand(id, valor);
  }

  async deactivateBrand(id: string): Promise<void> {
    await this.assertNotInUse('marca_id', id, await this.catalog.findBrands());
    await this.catalog.deactivateBrand(id);
  }

  // --- modelos (el nombre es único dentro de su marca) ---

  async findModels(): Promise<CatalogItemWithUsage<EmergencyVehicleModel>[]> {
    const [models, usage] = await Promise.all([
      this.catalog.findModels(),
      this.vehicles.countActiveByCatalog(),
    ]);
    return this.withUsage(models, usage.modelos);
  }

  async createModel(
    name: string,
    brandId: string,
  ): Promise<EmergencyVehicleModel> {
    const valor = this.requireName(name);
    const sameBrand = (await this.catalog.findModels()).filter(
      (m) => m.marcaId === brandId,
    );
    this.assertUniqueName(sameBrand, valor, DUPLICATE.model);
    return this.catalog.createModel(valor, brandId);
  }

  async updateModel(id: string, name: string): Promise<EmergencyVehicleModel> {
    const valor = this.requireName(name);
    const models = await this.catalog.findModels();
    const brandId = models.find((m) => m.id === id)?.marcaId;
    this.assertUniqueName(
      models.filter((m) => m.marcaId === brandId),
      valor,
      DUPLICATE.model,
      id,
    );
    return this.catalog.updateModel(id, valor);
  }

  async deactivateModel(id: string): Promise<void> {
    await this.assertNotInUse('modelo_id', id, await this.catalog.findModels());
    await this.catalog.deactivateModel(id);
  }
}

export interface EmergencyVehicleType {
  id: string;
  valor: string;
}

export interface EmergencyVehicleBrand {
  id: string;
  valor: string;
}

export interface EmergencyVehicleModel {
  id: string;
  valor: string;
  marcaId: string;
}

/** Catalog entry plus how many active vehicles use it ("2 móviles"). */
export type CatalogItemWithUsage<T> = T & { enUso: number };

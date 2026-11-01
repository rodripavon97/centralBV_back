import type { EmergencyVehicleStatus } from './emergency-vehicle.enums.js';
import type { RevisionItems } from './revision.entity.js';
import { REVISION_ITEM_KEYS } from './revision.enums.js';

/**
 * Deriva el estado del móvil a partir de los ítems de una revisión.
 * CRITICO manda sobre ADVERTENCIA; todo OK → OPERATIVO.
 */
export function estadoDesdeRevision(
  items: RevisionItems,
): Extract<
  EmergencyVehicleStatus,
  'OPERATIVO' | 'OBSERVACIONES' | 'FUERA_SERVICIO'
> {
  let tieneAdvertencia = false;
  for (const key of REVISION_ITEM_KEYS) {
    const estado = items[key].estado;
    if (estado === 'CRITICO') return 'FUERA_SERVICIO';
    if (estado === 'ADVERTENCIA') tieneAdvertencia = true;
  }
  return tieneAdvertencia ? 'OBSERVACIONES' : 'OPERATIVO';
}

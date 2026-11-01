import { estadoDesdeRevision } from '../domain/revision-status.js';
import type { ItemRevision, RevisionItems } from '../domain/revision.entity.js';
import { REVISION_ITEM_KEYS } from '../domain/revision.enums.js';

const ok = (): ItemRevision => ({ estado: 'OK', comentario: null });
const adv = (comentario = 'ojo'): ItemRevision => ({
  estado: 'ADVERTENCIA',
  comentario,
});
const crit = (comentario = 'grave'): ItemRevision => ({
  estado: 'CRITICO',
  comentario,
});

const allOk = (): RevisionItems => {
  const items = {} as RevisionItems;
  for (const key of REVISION_ITEM_KEYS) items[key] = ok();
  return items;
};

describe('estadoDesdeRevision', () => {
  it('todo OK → OPERATIVO', () => {
    expect(estadoDesdeRevision(allOk())).toBe('OPERATIVO');
  });

  it('al menos una ADVERTENCIA (sin críticos) → OBSERVACIONES', () => {
    const items = allOk();
    items.frenos = adv('pastillas al límite');
    expect(estadoDesdeRevision(items)).toBe('OBSERVACIONES');
  });

  it('CRITICO manda sobre ADVERTENCIA → FUERA_SERVICIO', () => {
    const items = allOk();
    items.nivelAceite = adv();
    items.bateria = crit('no arranca');
    expect(estadoDesdeRevision(items)).toBe('FUERA_SERVICIO');
  });

  it('solo CRITICO → FUERA_SERVICIO', () => {
    const items = allOk();
    items.lucesYBalizas = crit();
    expect(estadoDesdeRevision(items)).toBe('FUERA_SERVICIO');
  });
});

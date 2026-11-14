import {
  nextOrderInZone,
  normalizeCompartmentName,
  planCompartments,
  sameCompartmentName,
  sortCompartments,
} from '../domain/compartment-plan.js';

describe('compartment plan', () => {
  it('genera LC, LA y TR numerados, y TE / CB solo si están activos', () => {
    const plan = planCompartments({
      ladoConductor: 2,
      ladoAcompanante: 1,
      trasero: 1,
      techo: true,
      cabina: false,
    });
    expect(plan).toEqual([
      { zona: 'LADO_CONDUCTOR', nombre: 'LC-1', orden: 1 },
      { zona: 'LADO_CONDUCTOR', nombre: 'LC-2', orden: 2 },
      { zona: 'LADO_ACOMPANANTE', nombre: 'LA-1', orden: 1 },
      { zona: 'TRASERO', nombre: 'TR-1', orden: 1 },
      { zona: 'TECHO', nombre: 'TE-1', orden: 1 },
    ]);
  });

  it('el ejemplo de Figma crea 9 buches', () => {
    const plan = planCompartments({
      ladoConductor: 5,
      ladoAcompanante: 2,
      trasero: 1,
      techo: true,
      cabina: false,
    });
    expect(plan.map((c) => c.nombre)).toEqual([
      'LC-1',
      'LC-2',
      'LC-3',
      'LC-4',
      'LC-5',
      'LA-1',
      'LA-2',
      'TR-1',
      'TE-1',
    ]);
  });

  it('todo en cero no genera nada', () => {
    expect(
      planCompartments({
        ladoConductor: 0,
        ladoAcompanante: 0,
        trasero: 0,
        techo: false,
        cabina: false,
      }),
    ).toEqual([]);
  });

  it('normaliza el nombre y compara sin mayúsculas', () => {
    expect(normalizeCompartmentName('  lc   6 ')).toBe('LC 6');
    expect(sameCompartmentName('lc-2', 'LC-2')).toBe(true);
  });

  it('el siguiente orden va al final de la zona', () => {
    const existing = [
      { zona: 'LADO_CONDUCTOR' as const, orden: 1 },
      { zona: 'LADO_CONDUCTOR' as const, orden: 3 },
      { zona: 'TRASERO' as const, orden: 1 },
    ];
    expect(nextOrderInZone(existing, 'LADO_CONDUCTOR')).toBe(4);
    expect(nextOrderInZone(existing, 'CABINA')).toBe(1);
  });

  it('ordena por zona del plano y después por posición', () => {
    const sorted = sortCompartments([
      { zona: 'TECHO' as const, orden: 1, n: 'TE-1' },
      { zona: 'LADO_ACOMPANANTE' as const, orden: 1, n: 'LA-1' },
      { zona: 'LADO_CONDUCTOR' as const, orden: 2, n: 'LC-2' },
      { zona: 'LADO_CONDUCTOR' as const, orden: 1, n: 'LC-1' },
    ]);
    expect(sorted.map((c) => c.n)).toEqual(['LC-1', 'LC-2', 'LA-1', 'TE-1']);
  });
});

import {
  canAdvanceTo,
  isModifiable,
  isStatusTransitionValid,
} from '../domain/certificate-request.entity.js';

describe('isModifiable', () => {
  it('solo permite modificar solicitudes PENDIENTE', () => {
    expect(isModifiable('PENDIENTE')).toBe(true);
    expect(isModifiable('REALIZADA')).toBe(false);
    expect(isModifiable('FIRMADA')).toBe(false);
    expect(isModifiable('RETIRADA')).toBe(false);
    expect(isModifiable('CANCELADA')).toBe(false);
  });
});

describe('isStatusTransitionValid', () => {
  it('permite permanecer en el mismo estado', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'PENDIENTE')).toBe(true);
    expect(isStatusTransitionValid('FIRMADA', 'FIRMADA')).toBe(true);
  });

  it('permite las transiciones del ciclo feliz', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'REALIZADA')).toBe(true);
    expect(isStatusTransitionValid('PENDIENTE', 'CANCELADA')).toBe(true);
    expect(isStatusTransitionValid('REALIZADA', 'FIRMADA')).toBe(true);
    expect(isStatusTransitionValid('FIRMADA', 'RETIRADA')).toBe(true);
  });

  it('bloquea saltos y estados terminales', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'FIRMADA')).toBe(false);
    expect(isStatusTransitionValid('REALIZADA', 'RETIRADA')).toBe(false);
    expect(isStatusTransitionValid('FIRMADA', 'CANCELADA')).toBe(false);
    expect(isStatusTransitionValid('RETIRADA', 'FIRMADA')).toBe(false);
    expect(isStatusTransitionValid('CANCELADA', 'PENDIENTE')).toBe(false);
  });
});

describe('canAdvanceTo', () => {
  it('exige un cambio real de estado', () => {
    expect(canAdvanceTo('FIRMADA', 'FIRMADA')).toBe(false);
    expect(canAdvanceTo('REALIZADA', 'FIRMADA')).toBe(true);
    expect(canAdvanceTo('PENDIENTE', 'FIRMADA')).toBe(false);
  });
});

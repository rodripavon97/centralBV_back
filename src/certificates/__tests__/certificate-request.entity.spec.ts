import {
  canAdvanceTo,
  isModifiable,
  isStatusTransitionValid,
} from '../domain/certificate-request.entity.js';

describe('isModifiable', () => {
  it('only allows modifying PENDIENTE requests', () => {
    expect(isModifiable('PENDIENTE')).toBe(true);
    expect(isModifiable('REALIZADA')).toBe(false);
    expect(isModifiable('FIRMADA')).toBe(false);
    expect(isModifiable('RETIRADA')).toBe(false);
    expect(isModifiable('CANCELADA')).toBe(false);
  });
});

describe('isStatusTransitionValid', () => {
  it('allows staying in the same status', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'PENDIENTE')).toBe(true);
    expect(isStatusTransitionValid('FIRMADA', 'FIRMADA')).toBe(true);
  });

  it('allows happy-path transitions', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'REALIZADA')).toBe(true);
    expect(isStatusTransitionValid('PENDIENTE', 'CANCELADA')).toBe(true);
    expect(isStatusTransitionValid('REALIZADA', 'FIRMADA')).toBe(true);
    expect(isStatusTransitionValid('FIRMADA', 'RETIRADA')).toBe(true);
  });

  it('blocks jumps and terminal statuses', () => {
    expect(isStatusTransitionValid('PENDIENTE', 'FIRMADA')).toBe(false);
    expect(isStatusTransitionValid('REALIZADA', 'RETIRADA')).toBe(false);
    expect(isStatusTransitionValid('FIRMADA', 'CANCELADA')).toBe(false);
    expect(isStatusTransitionValid('RETIRADA', 'FIRMADA')).toBe(false);
    expect(isStatusTransitionValid('CANCELADA', 'PENDIENTE')).toBe(false);
  });
});

describe('canAdvanceTo', () => {
  it('requires a real status change', () => {
    expect(canAdvanceTo('FIRMADA', 'FIRMADA')).toBe(false);
    expect(canAdvanceTo('REALIZADA', 'FIRMADA')).toBe(true);
    expect(canAdvanceTo('PENDIENTE', 'FIRMADA')).toBe(false);
  });
});

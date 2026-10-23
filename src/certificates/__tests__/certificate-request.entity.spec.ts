import {
  canAdvanceTo,
  isModifiable,
  isStatusTransitionValid,
} from '../domain/certificate-request.entity.js';
import {
  ahoraEnArgentina,
  esFechaHoraValida,
} from '../../common/utils/date.utils.js';

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

describe('esFechaHoraValida', () => {
  it('acepta fechas existentes con formato AAAA-MM-DDTHH:mm', () => {
    expect(esFechaHoraValida('2026-10-11T18:20')).toBe(true);
    expect(esFechaHoraValida('2024-02-29T00:00')).toBe(true);
  });

  it('rechaza fechas inexistentes o mal formadas', () => {
    expect(esFechaHoraValida('2026-02-30T10:00')).toBe(false);
    expect(esFechaHoraValida('2026-13-01T10:00')).toBe(false);
    expect(esFechaHoraValida('2026-10-11 18:20')).toBe(false);
    expect(esFechaHoraValida('11/10/2026T18:20')).toBe(false);
    expect(esFechaHoraValida('2026-10-11T24:00')).toBe(false);
    expect(esFechaHoraValida('2026-10-11T12:60')).toBe(false);
  });
});

describe('ahoraEnArgentina', () => {
  it('formatea en zona Argentina con precisión de minutos', () => {
    // 2026-10-11 21:20:45 UTC → 18:20 en Buenos Aires (UTC-3)
    const fecha = new Date('2026-10-11T21:20:45.000Z');
    expect(ahoraEnArgentina(fecha)).toBe('2026-10-11T18:20');
  });
});

import {
  denominationKey,
  normalizeDenomination,
} from '../domain/denomination.js';

describe('normalizeDenomination', () => {
  it.each([
    ['m1', 'M-1'],
    ['M 1', 'M-1'],
    ['m-1', 'M-1'],
    [' M_12 ', 'M-12'],
    ['m.3', 'M-3'],
    ['ab-04', 'AB-04'],
  ])('letras + número: %s → %s', (raw, expected) => {
    expect(normalizeDenomination(raw)).toBe(expected);
  });

  it('deja en mayúsculas lo que no es letras + número', () => {
    expect(normalizeDenomination('  unidad   rescate  ')).toBe(
      'UNIDAD RESCATE',
    );
    expect(normalizeDenomination('M-1-B')).toBe('M-1-B');
  });

  it('quita acentos', () => {
    expect(normalizeDenomination('móvil 7')).toBe('MOVIL-7');
    expect(normalizeDenomination('Cisterna Ñandú')).toBe('CISTERNA NANDU');
  });

  it('devuelve vacío si solo hay espacios', () => {
    expect(normalizeDenomination('   ')).toBe('');
  });
});

describe('denominationKey', () => {
  it('M-1, M1 y m 1 tienen la misma clave', () => {
    expect(denominationKey('M-1')).toBe('M1');
    expect(denominationKey('M1')).toBe('M1');
    expect(denominationKey('m 1')).toBe('M1');
  });

  it('coincide con la columna generada (solo letras y dígitos)', () => {
    expect(denominationKey('AB-04')).toBe('AB04');
  });
});

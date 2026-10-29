import {
  detectLicensePlateFormat,
  formatLicensePlate,
  normalizeLicensePlate,
} from '../domain/license-plate.js';

describe('normalizeLicensePlate', () => {
  it('pasa a mayúsculas y quita espacios, guiones y puntos', () => {
    expect(normalizeLicensePlate(' ab 123-cd ')).toBe('AB123CD');
    expect(normalizeLicensePlate('a.b.c 123')).toBe('ABC123');
  });

  it('quita acentos', () => {
    expect(normalizeLicensePlate('áb123cd')).toBe('AB123CD');
  });

  it('devuelve vacío si no hay letras ni números', () => {
    expect(normalizeLicensePlate(' - . ')).toBe('');
  });
});

describe('detectLicensePlateFormat', () => {
  it.each([
    ['AB123CD', 'MERCOSUR_AUTO'],
    ['ABC123', 'AUTO_1995'],
    ['A123BCD', 'MERCOSUR_MOTO'],
    ['123ABC', 'MOTO_1995'],
    ['B1234567', 'PROVINCIAL'],
    ['C12345', 'PROVINCIAL'],
  ])('%s → %s', (plate, format) => {
    expect(detectLicensePlateFormat(plate)).toBe(format);
  });

  it.each(['AB12CD', 'ABCD123', '12345', 'X1', 'B123'])(
    '%s no coincide con ningún formato',
    (plate) => {
      expect(detectLicensePlateFormat(plate)).toBeNull();
    },
  );
});

describe('formatLicensePlate', () => {
  it.each([
    ['AB123CD', 'AB 123 CD'],
    ['ABC123', 'ABC 123'],
    ['A123BCD', 'A 123 BCD'],
    ['123ABC', '123 ABC'],
    ['B1234567', 'B 1234567'],
  ])('%s → %s', (plate, formatted) => {
    expect(formatLicensePlate(plate)).toBe(formatted);
  });

  it('deja igual una patente de formato desconocido', () => {
    expect(formatLicensePlate('OFICIAL01')).toBe('OFICIAL01');
  });
});

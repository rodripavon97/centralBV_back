import {
  ahoraEnArgentina,
  esFechaHoraValida,
  esPosteriorA,
} from './date.utils.js';

describe('date.utils', () => {
  describe('ahoraEnArgentina', () => {
    it('formatea en zona Argentina con fecha y hora separadas', () => {
      // 2026-10-11 21:20:45 UTC → 18:20 en Buenos Aires (UTC-3)
      expect(ahoraEnArgentina(new Date('2026-10-11T21:20:45.000Z'))).toEqual({
        fecha: '2026-10-11',
        hora: '18:20',
      });
    });
  });

  describe('esFechaHoraValida', () => {
    it('acepta fechas existentes', () => {
      expect(esFechaHoraValida('2026-10-11', '18:20')).toBe(true);
      expect(esFechaHoraValida('2024-02-29', '00:00')).toBe(true);
    });

    it('rechaza fechas inexistentes o mal formadas', () => {
      expect(esFechaHoraValida('2026-02-30', '10:00')).toBe(false);
      expect(esFechaHoraValida('2026-13-01', '10:00')).toBe(false);
      expect(esFechaHoraValida('11/10/2026', '18:20')).toBe(false);
      expect(esFechaHoraValida('2026-10-11', '24:00')).toBe(false);
      expect(esFechaHoraValida('2026-10-11', '12:60')).toBe(false);
      expect(esFechaHoraValida('2026-10-11', '18')).toBe(false);
    });
  });

  describe('esPosteriorA', () => {
    it('compara fecha y hora lexicográficamente', () => {
      expect(esPosteriorA('2026-10-12', '00:00', '2026-10-11', '23:59')).toBe(
        true,
      );
      expect(esPosteriorA('2026-10-11', '18:20', '2026-10-11', '18:20')).toBe(
        false,
      );
      expect(esPosteriorA('2026-10-11', '10:00', '2026-10-11', '18:20')).toBe(
        false,
      );
    });
  });
});

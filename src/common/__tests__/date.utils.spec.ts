import {
  nowInArgentina,
  isValidDateAndTime,
  isStrictlyAfter,
} from '../utils/date.utils.js';

describe('date.utils', () => {
  describe('nowInArgentina', () => {
    it('formats in Argentina timezone with date and time separated', () => {
      // 2026-10-11 21:20:45 UTC → 18:20 en Buenos Aires (UTC-3)
      expect(nowInArgentina(new Date('2026-10-11T21:20:45.000Z'))).toEqual({
        date: '2026-10-11',
        time: '18:20',
      });
    });
  });

  describe('isValidDateAndTime', () => {
    it('accepts existing dates', () => {
      expect(isValidDateAndTime('2026-10-11', '18:20')).toBe(true);
      expect(isValidDateAndTime('2024-02-29', '00:00')).toBe(true);
    });

    it('rejects non-existent or malformed dates', () => {
      expect(isValidDateAndTime('2026-02-30', '10:00')).toBe(false);
      expect(isValidDateAndTime('2026-13-01', '10:00')).toBe(false);
      expect(isValidDateAndTime('11/10/2026', '18:20')).toBe(false);
      expect(isValidDateAndTime('2026-10-11', '24:00')).toBe(false);
      expect(isValidDateAndTime('2026-10-11', '12:60')).toBe(false);
      expect(isValidDateAndTime('2026-10-11', '18')).toBe(false);
    });
  });

  describe('isStrictlyAfter', () => {
    it('compares date and time lexicographically', () => {
      expect(
        isStrictlyAfter('2026-10-12', '00:00', '2026-10-11', '23:59'),
      ).toBe(true);
      expect(
        isStrictlyAfter('2026-10-11', '18:20', '2026-10-11', '18:20'),
      ).toBe(false);
      expect(
        isStrictlyAfter('2026-10-11', '10:00', '2026-10-11', '18:20'),
      ).toBe(false);
    });
  });
});

import {
  buildPaginatedResponse,
  totalPages,
  paginationRange,
} from '../utils/pagination.utils.js';

describe('pagination.utils', () => {
  describe('totalPages', () => {
    it('calculates pages with 20 records per page', () => {
      expect(totalPages(47, 20)).toBe(3);
    });

    it('returns at least 1 page even when total is 0', () => {
      expect(totalPages(0, 20)).toBe(1);
    });
  });

  describe('paginationRange', () => {
    it('calculates the inclusive range for the requested page', () => {
      expect(paginationRange(2, 20, 47)).toEqual({
        from: 20,
        to: 39,
        page: 2,
        pages: 3,
      });
    });

    it('clamps the requested page to the last existing page', () => {
      expect(paginationRange(9, 20, 5)).toEqual({
        from: 0,
        to: 19,
        page: 1,
        pages: 1,
      });
    });
  });

  describe('buildPaginatedResponse', () => {
    it('builds the response with pagination metadata', () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      expect(buildPaginatedResponse(items, 47, 2, 20)).toEqual({
        items,
        total: 47,
        pagina: 2,
        paginas: 3,
        porPagina: 20,
      });
    });

    it('clamps the page in the response when requesting past the end', () => {
      expect(buildPaginatedResponse([], 5, 9, 20)).toMatchObject({
        pagina: 1,
        paginas: 1,
        porPagina: 20,
        total: 5,
      });
    });
  });
});

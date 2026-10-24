import {
  armarRespuestaPaginada,
  calcularPaginas,
  rangoPaginacion,
} from './pagination.utils.js';

describe('pagination.utils', () => {
  describe('calcularPaginas', () => {
    it('calcula las páginas con 20 registros por página', () => {
      expect(calcularPaginas(47, 20)).toBe(3);
    });

    it('devuelve al menos 1 página aunque total sea 0', () => {
      expect(calcularPaginas(0, 20)).toBe(1);
    });
  });

  describe('rangoPaginacion', () => {
    it('calcula el rango inclusivo de la página pedida', () => {
      expect(rangoPaginacion(2, 20, 47)).toEqual({
        desde: 20,
        hasta: 39,
        pagina: 2,
        paginas: 3,
      });
    });

    it('limita la página pedida a la última que existe', () => {
      expect(rangoPaginacion(9, 20, 5)).toEqual({
        desde: 0,
        hasta: 19,
        pagina: 1,
        paginas: 1,
      });
    });
  });

  describe('armarRespuestaPaginada', () => {
    it('arma la respuesta con metadatos de paginación', () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      expect(armarRespuestaPaginada(items, 47, 2, 20)).toEqual({
        items,
        total: 47,
        pagina: 2,
        paginas: 3,
        porPagina: 20,
      });
    });

    it('limita la página en la respuesta cuando se pide de más', () => {
      expect(armarRespuestaPaginada([], 5, 9, 20)).toMatchObject({
        pagina: 1,
        paginas: 1,
        porPagina: 20,
        total: 5,
      });
    });
  });
});

export type RespuestaPaginada<T> = {
  items: T[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
};

/** Total de páginas; al menos 1 aunque total sea 0. */
export function calcularPaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/** Rango inclusivo para PostgREST `.range(desde, hasta)`, con página clampada. */
export function rangoPaginacion(
  pagina: number,
  porPagina: number,
  total: number,
): { desde: number; hasta: number; pagina: number; paginas: number } {
  const paginas = calcularPaginas(total, porPagina);
  const paginaClamped = Math.min(Math.max(1, pagina), paginas);
  const desde = (paginaClamped - 1) * porPagina;
  return {
    desde,
    hasta: desde + porPagina - 1,
    pagina: paginaClamped,
    paginas,
  };
}

/** Arma la respuesta de listado a partir de items + total. */
export function armarRespuestaPaginada<T>(
  items: T[],
  total: number,
  pagina: number,
  porPagina: number,
): RespuestaPaginada<T> {
  const { pagina: paginaClamped, paginas } = rangoPaginacion(
    pagina,
    porPagina,
    total,
  );
  return {
    items,
    total,
    pagina: paginaClamped,
    paginas,
    porPagina,
  };
}

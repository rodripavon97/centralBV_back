export type Paginated<T> = {
  items: T[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
};

/** Calculates the total number of pages; at least 1 even if total is 0. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Inclusive range for PostgREST `.range(from, to)`, with page clamped. */
export function paginationRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number; page: number; pages: number } {
  const pages = totalPages(total, pageSize);
  const pageClamped = Math.min(Math.max(1, page), pages);
  const from = (pageClamped - 1) * pageSize;
  return {
    from,
    to: from + pageSize - 1,
    page: pageClamped,
    pages,
  };
}

/** Builds the paginated response from items + total. */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  const { page: pageClamped, pages } = paginationRange(page, pageSize, total);
  return {
    items,
    total,
    pagina: pageClamped,
    paginas: pages,
    porPagina: pageSize,
  };
}

/** The arithmetic of a report's pagination (`Pagination`, `usePagination`). Pure: tested in `pagination.test.ts`. */

/** Rows per page of a report's table (the Conecta's: 25; the PC's "Por página" starts there). */
export const PAGE_SIZE = 25;

/** What the PC's "Por página" offers (the FBMaker's pager). */
export const PAGE_SIZES: readonly number[] = [10, 25, 50];

/** How many pages `total` rows take (at least one: an empty list is page 1 of 1). */
export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A page that exists (0-based): never below the first nor past the last. */
export function clampPage(page: number, total: number, pageSize = PAGE_SIZE): number {
  return Math.max(0, Math.min(Math.trunc(page), pageCount(total, pageSize) - 1));
}

/**
 * The page buttons around the current one: up to `size` of them, `before` of
 * them ahead of it when it can be (by default the current one in the middle;
 * the PC's pager keeps 3 ahead, the FBMaker's).
 */
export function pageWindow(page: number, pages: number, size = 8, before = Math.floor(Math.min(size, pages) / 2)): number[] {
  const n = Math.min(size, pages);
  const start = Math.max(0, Math.min(page - before, pages - n));
  return Array.from({ length: n }, (_, i) => start + i);
}

/** "Itens 26 - 50" of "Total de 52": the first and the last row shown (0 and 0 when there is none). */
export function pageRange(page: number, total: number, pageSize = PAGE_SIZE): { first: number; last: number } {
  if (total === 0) return { first: 0, last: 0 };
  return { first: page * pageSize + 1, last: Math.min((page + 1) * pageSize, total) };
}

/** The page (0-based) that still shows the first row of `page` once a page holds `to` rows instead of `from`. */
export function pageAfterResize(page: number, from: number, to: number): number {
  return Math.floor((page * from) / to);
}

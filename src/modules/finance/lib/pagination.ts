/** Taille de page par défaut pour les listes Finance. */
export const FINANCE_LIST_PAGE_SIZE = 15;

export const OPERATIONS_PAGE_SIZE = 10;

export function paginateList<T>(items: T[], page: number, pageSize = FINANCE_LIST_PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total,
    pageSize,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}

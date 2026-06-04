import { useState, useEffect, useMemo } from 'react';
import { paginateList, LIST_PAGE_SIZE } from '@/lib/listPagination';

/**
 * Paginates a client-side list. Resets to page 1 when `resetKey` or item count changes.
 */
export function useListPagination<T>(
  items: T[],
  resetKey?: string | number,
  pageSize = LIST_PAGE_SIZE
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, items.length]);

  return useMemo(() => {
    const result = paginateList(items, page, pageSize);
    return { ...result, setPage };
  }, [items, page, pageSize]);
}

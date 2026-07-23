import { useState, useEffect, useMemo, useCallback } from 'react';
import { paginateList, LIST_PAGE_SIZE } from '@/lib/listPagination';

/**
 * Paginates a client-side list. Resets to page 1 when `resetKey` changes.
 * Clamps the page when the item count shrinks (does not reset on length alone).
 */
export function useListPagination<T>(
  items: T[],
  resetKey?: string | number,
  pageSize = LIST_PAGE_SIZE
) {
  const [page, setPageState] = useState(1);

  useEffect(() => {
    setPageState(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);

  useEffect(() => {
    setPageState((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next;
        return Math.min(Math.max(1, raw), Math.max(1, Math.ceil(items.length / pageSize) || 1));
      });
    },
    [items.length, pageSize]
  );

  return useMemo(() => {
    const result = paginateList(items, page, pageSize);
    return { ...result, setPage };
  }, [items, page, pageSize, setPage]);
}

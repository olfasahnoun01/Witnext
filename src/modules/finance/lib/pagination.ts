/** Re-exports shared list pagination with Finance-specific default page sizes. */
export { LIST_PAGE_SIZE } from '@/lib/listPagination';

export const FINANCE_LIST_PAGE_SIZE = 15;
export const OPERATIONS_PAGE_SIZE = 10;

import { paginateList as paginateListCore } from '@/lib/listPagination';

/** Finance lists default to 15 items per page. */
export function paginateList<T>(items: T[], page: number, pageSize = FINANCE_LIST_PAGE_SIZE) {
  return paginateListCore(items, page, pageSize);
}

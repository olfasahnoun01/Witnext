import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Pagination bar for list views (10 items per page by default). */
export function ListPagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
  className,
}: ListPaginationProps) {
  if (total === 0) return null;

  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border/60 mt-3 ${className ?? ''}`}
    >
      <p className="text-xs text-muted-foreground">
        {from}–{to} sur {total}
        {totalPages > 1 ? ` · page ${page}/${totalPages}` : ''}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          {totalPages > 1 &&
            pages.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

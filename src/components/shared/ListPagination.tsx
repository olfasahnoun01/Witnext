import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border/60 mt-3',
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        {from}–{to} sur {total}
        {totalPages > 1 ? ` · page ${page}/${totalPages}` : ''}
      </p>
      <div className="flex flex-row items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 pl-2.5"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        {totalPages > 1 &&
          pages.map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === page ? 'outline' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 pr-2.5"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          Suivant
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

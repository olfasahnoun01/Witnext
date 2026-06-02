import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { FinanceNavItem } from '../../lib/financeNavigation';

interface FinanceSubNavProps {
  items: FinanceNavItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/** Barre de sous-navigation (niveau 2) — sous chaque section principale Finance. */
export function FinanceSubNav({ items, value, onValueChange, className }: FinanceSubNavProps) {
  if (items.length <= 1) return null;

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-1', className)}>
      <Tabs value={value} onValueChange={onValueChange} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0.5 bg-transparent p-0">
          {items.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className={cn(
                'h-auto min-h-9 shrink-0 rounded-md px-3 py-2 text-xs sm:text-sm',
                'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground'
              )}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

interface FinanceSectionHeaderProps {
  title: string;
}

export function FinanceSectionHeader({ title }: FinanceSectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

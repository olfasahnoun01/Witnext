import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { FinanceMainSectionId, FinanceNavItem } from '../../lib/financeNavigation';
import { getFinanceSectionTheme } from '../../lib/financeSectionThemes';

interface FinanceSubNavProps {
  items: FinanceNavItem[];
  value: string;
  onValueChange: (value: string) => void;
  sectionId: FinanceMainSectionId;
  className?: string;
}

/** Barre de sous-navigation (niveau 2) — sous chaque section principale Finance. */
export function FinanceSubNav({ items, value, onValueChange, sectionId, className }: FinanceSubNavProps) {
  if (items.length <= 1) return null;

  const theme = getFinanceSectionTheme(sectionId);

  return (
    <div className={cn('rounded-lg border-2 overflow-hidden shadow-sm', theme.subNavShell, className)}>
      <div className={cn('h-1 w-full', theme.accentBar)} aria-hidden />
      <Tabs value={value} onValueChange={onValueChange} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/30 p-2">
          {items.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className={cn(
                'h-auto min-h-9 shrink-0 rounded-md px-3 py-2 text-xs sm:text-sm border transition-colors',
                theme.subTabInactive,
                theme.subTabActive
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

interface FinanceWorkAreaProps {
  sectionId: FinanceMainSectionId;
  children: ReactNode;
  className?: string;
}

/** Bordered content panel — makes the active work zone obvious. */
export function FinanceWorkArea({ sectionId, children, className }: FinanceWorkAreaProps) {
  const theme = getFinanceSectionTheme(sectionId);

  return (
    <div className={cn('rounded-lg border-2 p-4 sm:p-5 shadow-sm min-h-[12rem]', theme.workArea, className)}>
      {children}
    </div>
  );
}

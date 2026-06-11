import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FluxListTab } from '../types/dossierTypes';

interface FluxStatusTabsProps {
  tab: FluxListTab;
  onTabChange: (tab: FluxListTab) => void;
  counts: { en_cours: number; termines: number; incomplets: number };
}

const TABS: { id: FluxListTab; label: string }[] = [
  { id: 'en_cours', label: 'En cours' },
  { id: 'termines', label: 'Terminés' },
  { id: 'incomplets', label: 'Pièces manquantes' },
];

export function FluxStatusTabs({ tab, onTabChange, counts }: FluxStatusTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const count = counts[t.id];
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground hover:bg-muted/60'
            )}
          >
            {t.label}
            <Badge
              variant={active ? 'secondary' : 'outline'}
              className={cn('tabular-nums', active && 'bg-primary-foreground/15 text-primary-foreground border-0')}
            >
              {count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

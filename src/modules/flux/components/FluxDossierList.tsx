import { ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FluxDossierDetail } from '../types/dossierTypes';
import { fluxHealthLabel } from '../types/dossierTypes';
import { missingStepChips } from '../services/fluxResolver';

interface FluxDossierListProps {
  dossiers: FluxDossierDetail[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (d: FluxDossierDetail) => void;
  emptyMessage?: string;
}

export function FluxDossierList({
  dossiers,
  loading,
  selectedId,
  onSelect,
  emptyMessage = 'Aucun dossier dans cette liste.',
}: FluxDossierListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (dossiers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p>{emptyMessage}</p>
        <p className="text-sm mt-2">
          Créez ou confirmez un BC client pour démarrer le suivi, ou importez les BC récents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dossiers.map((d) => {
        const chips = missingStepChips(d.missingSteps);
        const selected = selectedId === d.id;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d)}
            className={cn(
              'w-full text-left rounded-xl border p-4 transition-colors hover:bg-muted/40',
              selected && 'border-primary bg-primary/5 ring-1 ring-primary/30'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground truncate">
                    {d.client_name ?? d.fournisseur_name ?? '—'}
                  </p>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    {d.dossier_number}
                  </Badge>
                  {d.bc_reference && (
                    <span className="text-xs text-muted-foreground font-mono">{d.bc_reference}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[200px]">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${d.completion_percent}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {d.completedSteps}/{d.totalSteps} étapes
                  </span>
                </div>
                {d.next_action_label && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1.5">{d.next_action_label}</p>
                )}
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {chips.map((c) => (
                      <Badge key={c} variant="destructive" className="text-[10px] font-normal">
                        Manque: {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  className={cn(
                    d.health === 'complete' && 'bg-green-100 text-green-800',
                    d.health === 'in_progress' && 'bg-blue-100 text-blue-800',
                    d.health === 'incomplete' && 'bg-red-100 text-red-800'
                  )}
                >
                  {fluxHealthLabel(d.health)}
                </Badge>
                <ChevronRight className="w-5 h-5 text-muted-foreground mt-2" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

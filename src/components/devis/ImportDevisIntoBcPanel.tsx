import { useMemo, useState } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { FileDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Devis } from '@/types';
import { validateDevisMergeForBc } from '@/lib/mergeCommercialDocuments';
import { toast } from 'sonner';
import { DevisFormSection } from './DevisFormUi';

type Props = {
  devisList: Devis[];
  onImport: (selected: Devis[]) => void;
  disabled?: boolean;
};

export function ImportDevisIntoBcPanel({ devisList, onImport, disabled }: Props) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return devisList;
    return devisList.filter((d) => {
      const party = (d.third_party_name || '').toLowerCase();
      return d.devis_number.toLowerCase().includes(term) || party.includes(term);
    });
  }, [devisList, search]);

  const selectedList = useMemo(
    () => devisList.filter((d) => selectedIds.has(d.id)),
    [devisList, selectedIds]
  );

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleImport = () => {
    if (selectedList.length === 0) {
      toast.error('Sélectionnez au moins un devis');
      return;
    }
    if (selectedList.length > 1) {
      const check = validateDevisMergeForBc(selectedList);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
    }
    onImport(selectedList);
    setSelectedIds(new Set());
    setSearch('');
  };

  if (devisList.length === 0) {
    return (
      <DevisFormSection
        title="Importer depuis la liste devis"
        description="Aucun devis disponible pour ce type (créez-en un dans Liste Devis)."
        icon={FileDown}
      >
        <p className="text-sm text-muted-foreground">La liste devis est vide pour l&apos;instant.</p>
      </DevisFormSection>
    );
  }

  return (
    <DevisFormSection
      title="Importer depuis la liste devis"
      description="Sélectionnez un ou plusieurs devis (même client/fournisseur) pour remplir le bon de commande."
      icon={FileDown}
    >
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° devis, client ou fournisseur…"
            className="pl-9 pr-8"
            disabled={disabled}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Aucun devis ne correspond.</p>
          ) : (
            filtered.map((d) => {
              const checked = selectedIds.has(d.id);
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-pressed={checked}
                  onClick={() => {
                    if (disabled) return;
                    toggle(d.id, !checked);
                  }}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(d.id, !checked);
                    }
                  }}
                  className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(d.id, v === true)}
                    disabled={disabled}
                    className="mt-0.5 pointer-events-none"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-foreground">{d.devis_number}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      — {d.third_party_name || 'Sans tiers'} ·{' '}
                      {formatAppDate(d.devis_date)} · {d.items?.length ?? 0}{' '}
                      ligne
                      {(d.items?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={disabled || selectedIds.size === 0}
          onClick={handleImport}
        >
          <FileDown className="h-4 w-4" />
          Importer {selectedIds.size > 0 ? `(${selectedIds.size} devis)` : ''}
        </Button>
      </div>
    </DevisFormSection>
  );
}

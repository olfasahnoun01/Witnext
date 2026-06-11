import { useMemo, useRef, useState } from 'react';
import { Building2, Loader2, Truck, User } from 'lucide-react';
import { DevisAnchoredDropdown } from '@/components/devis/DevisAnchoredDropdown';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FluxPartyOption } from '../services/fluxClientDocuments';

const MAX_SUGGESTIONS = 20;

interface FluxPartyAutocompleteProps {
  partyLabel: string;
  isClient: boolean;
  parties: FluxPartyOption[];
  loading: boolean;
  value: string;
  onValueChange: (value: string) => void;
  selectedParty: FluxPartyOption | null;
  onSelectParty: (party: FluxPartyOption | null) => void;
}

export function FluxPartyAutocomplete({
  partyLabel,
  isClient,
  parties,
  loading,
  value,
  onValueChange,
  selectedParty,
  onSelectParty,
}: FluxPartyAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? parties.filter((p) => p.nom.toLowerCase().includes(q)) : parties;
    return list.slice(0, MAX_SUGGESTIONS);
  }, [parties, value]);

  const showDropdown = focused && !loading && suggestions.length > 0;

  const handleSelect = (party: FluxPartyOption) => {
    onSelectParty(party);
    onValueChange(party.nom);
    setFocused(false);
    inputRef.current?.blur();
  };

  const PartyIcon = isClient ? Building2 : Truck;

  return (
    <div className="space-y-2">
      <Label htmlFor="flux-party-input">{partyLabel}</Label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="relative">
          <PartyIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            id="flux-party-input"
            className="pl-9 h-11"
            placeholder={
              isClient
                ? 'Tapez un nom de client… (ex. STE ABC SARL)'
                : 'Tapez un nom de fournisseur… (ex. Fournisseur XYZ)'
            }
            value={value}
            autoComplete="off"
            onChange={(e) => {
              onValueChange(e.target.value);
              onSelectParty(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setFocused(false), 150);
            }}
          />
          <DevisAnchoredDropdown
            anchorRef={inputRef}
            open={showDropdown}
            className="max-h-[280px]"
          >
            {suggestions.map((party) => {
              const isSelected = selectedParty != null && fluxPartyKey(selectedParty) === fluxPartyKey(party);
              return (
                <button
                  key={fluxPartyKey(party)}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(party);
                  }}
                  className={cn(
                    'w-full px-3 py-2.5 text-left text-sm hover:bg-muted border-b border-border last:border-b-0',
                    isSelected && 'bg-muted/60'
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {party.nom}
                  </span>
                  {party.source === 'devis' && (
                    <span className="block text-xs text-muted-foreground mt-0.5 pl-5">
                      Issu des devis existants
                    </span>
                  )}
                </button>
              );
            })}
          </DevisAnchoredDropdown>
        </div>
      )}
      {!loading && parties.some((p) => p.source === 'devis') && (
        <p className="text-xs text-muted-foreground">
          Suggestions depuis la liste officielle et les noms déjà saisis sur vos devis / BC.
        </p>
      )}
    </div>
  );
}

export function fluxPartyKey(p: FluxPartyOption): string {
  return `${p.kind}-${p.id ?? 'devis'}-${p.nom.trim().toLowerCase().replace(/\s+/g, '-')}`;
}

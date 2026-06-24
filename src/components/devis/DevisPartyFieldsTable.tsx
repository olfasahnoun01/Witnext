import { useRef } from 'react';
import { Building2, Calendar, FileDigit, Hash, MapPin, Phone, UserPlus } from 'lucide-react';
import { DevisAnchoredDropdown } from './DevisAnchoredDropdown';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ThirdPartySuggestion = {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
};

export interface DevisPartyFieldsTableProps {
  partyLabel: string;
  thirdPartyName: string;
  onThirdPartyNameChange: (value: string) => void;
  suggestions: ThirdPartySuggestion[];
  onSuggestionSelect: (item: ThirdPartySuggestion) => void;
  devisNumber: string;
  onDevisNumberChange: (value: string) => void;
  devisDate: string;
  onDevisDateChange: (value: string) => void;
  thirdPartyPhone: string;
  onThirdPartyPhoneChange: (value: string) => void;
  thirdPartyTaxId: string;
  onThirdPartyTaxIdChange: (value: string) => void;
  thirdPartyAddress: string;
  onThirdPartyAddressChange: (value: string) => void;
  docType: 'devis' | 'bc' | 'ba';
  documentStatus: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré';
  onDocumentStatusChange: (
    v: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré'
  ) => void;
  showNewParty?: boolean;
  onNewParty?: () => void;
  newPartyTitle?: string;
}

const fieldInputClass =
  'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors';

function FieldBlock({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />}
        {label}
      </label>
      {children}
    </div>
  );
}

export function DevisPartyFieldsTable({
  partyLabel,
  thirdPartyName,
  onThirdPartyNameChange,
  suggestions,
  onSuggestionSelect,
  devisNumber,
  onDevisNumberChange,
  devisDate,
  onDevisDateChange,
  thirdPartyPhone,
  onThirdPartyPhoneChange,
  thirdPartyTaxId,
  onThirdPartyTaxIdChange,
  thirdPartyAddress,
  onThirdPartyAddressChange,
  docType,
  documentStatus,
  onDocumentStatusChange,
  showNewParty,
  onNewParty,
  newPartyTitle = 'Nouveau',
}: DevisPartyFieldsTableProps) {
  const partyInputRef = useRef<HTMLInputElement>(null);
  const showStatus = docType === 'bc';

  return (
    <div className="rounded-xl border border-border/80 bg-gradient-to-br from-muted/30 via-background to-background p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{partyLabel}</p>
            <p className="text-xs text-muted-foreground">Coordonnées et référence du document</p>
          </div>
        </div>
        {showNewParty && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewParty}
            className="h-9 shrink-0 gap-1.5"
            title={newPartyTitle}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">{newPartyTitle}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        <FieldBlock label={partyLabel} icon={Building2} className="lg:col-span-5">
          <div className="relative">
            <input
              ref={partyInputRef}
              type="text"
              value={thirdPartyName}
              onChange={(e) => onThirdPartyNameChange(e.target.value)}
              className={fieldInputClass}
              placeholder={`Nom du ${partyLabel.toLowerCase()}…`}
              autoComplete="off"
            />
            <DevisAnchoredDropdown
              anchorRef={partyInputRef}
              open={suggestions.length > 0}
              className="max-h-44"
            >
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => onSuggestionSelect(item)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted border-b border-border last:border-b-0"
                >
                  <span className="font-medium">{item.nom}</span>
                  {item.matricule_fiscale && (
                    <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                      {item.matricule_fiscale}
                    </span>
                  )}
                </button>
              ))}
            </DevisAnchoredDropdown>
          </div>
        </FieldBlock>

        <FieldBlock label="N° document" icon={Hash} className="lg:col-span-2">
          <input
            type="text"
            value={devisNumber}
            onChange={(e) => onDevisNumberChange(e.target.value)}
            className={cn(fieldInputClass, 'font-mono')}
          />
        </FieldBlock>

        <FieldBlock label="Date" icon={Calendar} className="lg:col-span-2">
          <input
            type="date"
            value={devisDate}
            onChange={(e) => onDevisDateChange(e.target.value)}
            className={fieldInputClass}
          />
        </FieldBlock>

        {showStatus && (
          <FieldBlock label="Statut" icon={FileDigit} className="lg:col-span-3">
            <Select value={documentStatus} onValueChange={onDocumentStatusChange}>
              <SelectTrigger className={cn(fieldInputClass, 'h-10')}>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="envoyé">Envoyé</SelectItem>
                <SelectItem value="confirmé">Confirmé</SelectItem>
                <SelectItem value="reçu">Reçu</SelectItem>
                <SelectItem value="intégré">Intégré</SelectItem>
              </SelectContent>
            </Select>
          </FieldBlock>
        )}

        <FieldBlock label="Téléphone" icon={Phone} className="lg:col-span-3">
          <input
            type="text"
            value={thirdPartyPhone}
            onChange={(e) => onThirdPartyPhoneChange(e.target.value)}
            className={fieldInputClass}
            placeholder="+216 …"
          />
        </FieldBlock>

        <FieldBlock label="Matricule fiscal" icon={FileDigit} className="lg:col-span-3">
          <input
            type="text"
            value={thirdPartyTaxId}
            onChange={(e) => onThirdPartyTaxIdChange(e.target.value)}
            className={cn(fieldInputClass, 'font-mono text-xs sm:text-sm')}
            placeholder="MF / TVA"
          />
        </FieldBlock>

        <FieldBlock label="Adresse" icon={MapPin} className="lg:col-span-6">
          <input
            type="text"
            value={thirdPartyAddress}
            onChange={(e) => onThirdPartyAddressChange(e.target.value)}
            className={fieldInputClass}
            placeholder="Adresse complète"
          />
        </FieldBlock>
      </div>
    </div>
  );
}

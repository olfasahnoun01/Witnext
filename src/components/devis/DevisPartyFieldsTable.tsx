import { useRef } from 'react';
import { UserPlus } from 'lucide-react';
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
import {
  DevisFormTable,
  devisFormTableInputClass,
  devisFormTableTdClass,
  devisFormTableThClass,
} from './DevisFormUi';

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
  showNewFournisseur?: boolean;
  onNewFournisseur?: () => void;
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
  showNewFournisseur,
  onNewFournisseur,
}: DevisPartyFieldsTableProps) {
  const partyInputRef = useRef<HTMLInputElement>(null);
  const showStatus = docType === 'bc';

  return (
    <div className="space-y-3">
      <DevisFormTable>
        <colgroup>
          <col style={{ width: showStatus ? '38%' : '46%' }} />
          <col style={{ width: showStatus ? '18%' : '22%' }} />
          <col style={{ width: showStatus ? '16%' : '18%' }} />
          {showStatus && <col style={{ width: '18%' }} />}
          {showNewFournisseur && <col style={{ width: '10%' }} />}
        </colgroup>
        <thead>
          <tr>
            <th className={cn(devisFormTableThClass, 'text-left')}>{partyLabel}</th>
            <th className={cn(devisFormTableThClass, 'text-left')}>N° document</th>
            <th className={cn(devisFormTableThClass, 'text-left')}>Date</th>
            {showStatus && (
              <th className={cn(devisFormTableThClass, 'text-left')}>Statut</th>
            )}
            {showNewFournisseur && (
              <th className={cn(devisFormTableThClass, 'text-center')} aria-hidden />
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={devisFormTableTdClass}>
              <input
                ref={partyInputRef}
                type="text"
                value={thirdPartyName}
                onChange={(e) => onThirdPartyNameChange(e.target.value)}
                className={devisFormTableInputClass}
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
            </td>
            <td className={devisFormTableTdClass}>
              <input
                type="text"
                value={devisNumber}
                onChange={(e) => onDevisNumberChange(e.target.value)}
                className={devisFormTableInputClass}
              />
            </td>
            <td className={devisFormTableTdClass}>
              <input
                type="date"
                value={devisDate}
                onChange={(e) => onDevisDateChange(e.target.value)}
                className={devisFormTableInputClass}
              />
            </td>
            {showStatus && (
              <td className={devisFormTableTdClass}>
                <Select value={documentStatus} onValueChange={onDocumentStatusChange}>
                  <SelectTrigger className={cn(devisFormTableInputClass, 'h-9')}>
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
              </td>
            )}
            {showNewFournisseur && (
              <td className={cn(devisFormTableTdClass, 'text-center align-middle')}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onNewFournisseur}
                  className="h-8 w-full text-[11px] px-1.5"
                  title="Nouveau fournisseur"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                </Button>
              </td>
            )}
          </tr>
        </tbody>
      </DevisFormTable>

      <DevisFormTable>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '50%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={cn(devisFormTableThClass, 'text-left')}>Téléphone</th>
            <th className={cn(devisFormTableThClass, 'text-left')}>Matricule fiscal</th>
            <th className={cn(devisFormTableThClass, 'text-left')}>Adresse</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={devisFormTableTdClass}>
              <input
                type="text"
                value={thirdPartyPhone}
                onChange={(e) => onThirdPartyPhoneChange(e.target.value)}
                className={devisFormTableInputClass}
                placeholder="+216 …"
              />
            </td>
            <td className={devisFormTableTdClass}>
              <input
                type="text"
                value={thirdPartyTaxId}
                onChange={(e) => onThirdPartyTaxIdChange(e.target.value)}
                className={devisFormTableInputClass}
                placeholder="MF / TVA"
              />
            </td>
            <td className={devisFormTableTdClass}>
              <input
                type="text"
                value={thirdPartyAddress}
                onChange={(e) => onThirdPartyAddressChange(e.target.value)}
                className={devisFormTableInputClass}
                placeholder="Adresse complète"
              />
            </td>
          </tr>
        </tbody>
      </DevisFormTable>
    </div>
  );
}

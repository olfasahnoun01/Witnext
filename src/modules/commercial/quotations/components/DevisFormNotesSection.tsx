import { CommercialAttachmentField } from '@/components/shared/CommercialAttachmentField';
import { DevisField, DevisZohoTotalsPanel } from '@/components/devis/DevisFormUi';
import type { CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import type { DevisTotals } from '@/lib/devisPricing';

type DevisFormNotesSectionProps = {
  notes: string;
  onNotesChange: (v: string) => void;
  docType: 'devis' | 'bc' | 'ba';
  existingAttachments: CommercialAttachmentRecord[];
  pendingAttachmentFiles: File[];
  onPendingAttachmentFilesChange?: (files: File[]) => void;
  onRemoveExistingAttachment?: (index: number) => void;
  isSaving: boolean;
  devisTotals: DevisTotals;
  showTva: boolean;
};

export function DevisFormNotesSection({
  notes,
  onNotesChange,
  docType,
  existingAttachments,
  pendingAttachmentFiles,
  onPendingAttachmentFilesChange,
  onRemoveExistingAttachment,
  isSaving,
  devisTotals,
  showTva,
}: DevisFormNotesSectionProps) {
  return (
    <div className="px-4 sm:px-6 py-5 border-t border-border/60 flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-4 min-w-0">
        <DevisField label="Notes / conditions">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="form-input min-h-[80px] resize-y w-full"
            placeholder="Conditions de paiement, délais, remarques…"
          />
        </DevisField>
        {(docType === 'bc' || docType === 'devis') && onPendingAttachmentFilesChange && (
          <CommercialAttachmentField
            label={docType === 'bc' ? 'Bon de commande scanné / pièces jointes' : 'Pièces jointes'}
            hint={
              docType === 'bc'
                ? 'Optionnel — importez un BC déjà signé (PDF, photo…) ou tout fichier.'
                : 'Optionnel — PDF, images ou tout fichier.'
            }
            existing={existingAttachments}
            pendingFiles={pendingAttachmentFiles}
            onPendingChange={onPendingAttachmentFilesChange}
            onRemoveExisting={onRemoveExistingAttachment}
            disabled={isSaving}
          />
        )}
      </div>
      <DevisZohoTotalsPanel totals={devisTotals} showTva={showTva} />
    </div>
  );
}

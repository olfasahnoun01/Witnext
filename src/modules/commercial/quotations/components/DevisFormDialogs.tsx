import { ClientDocumentPreviewDialog } from '@/components/shared/ClientDocumentPreviewDialog';
import type { useDevisNewPartyDialogs } from '@/modules/commercial/quotations/hooks/useDevisNewPartyDialogs';
import type {
  AddVariantDialogProps,
  NewArticleDialogProps,
} from '@/modules/commercial/quotations/hooks/useDevisArticleDialogs';
import { DevisAddVariantDialog } from '@/modules/commercial/quotations/components/DevisAddVariantDialog';
import { DevisNewArticleDialog } from '@/modules/commercial/quotations/components/DevisNewArticleDialog';
import { DevisNewClientDialog } from '@/modules/commercial/quotations/components/DevisNewClientDialog';
import { DevisNewFournisseurDialog } from '@/modules/commercial/quotations/components/DevisNewFournisseurDialog';

type PartyDialogsResult = ReturnType<typeof useDevisNewPartyDialogs>;

type DevisFormDialogsProps = {
  fournisseurDialogProps: PartyDialogsResult['fournisseurDialogProps'];
  clientDialogProps: PartyDialogsResult['clientDialogProps'];
  newArticleDialogProps: NewArticleDialogProps;
  addVariantDialogProps: AddVariantDialogProps;
  documentPreview: PartyDialogsResult['documentPreview'];
  pdfBytesRef: PartyDialogsResult['pdfBytesRef'];
  closeDocumentPreview: PartyDialogsResult['closeDocumentPreview'];
};

export function DevisFormDialogs({
  fournisseurDialogProps,
  clientDialogProps,
  newArticleDialogProps,
  addVariantDialogProps,
  documentPreview,
  pdfBytesRef,
  closeDocumentPreview,
}: DevisFormDialogsProps) {
  return (
    <>
      <DevisNewFournisseurDialog {...fournisseurDialogProps} />
      <DevisNewClientDialog {...clientDialogProps} />
      <DevisNewArticleDialog {...newArticleDialogProps} />
      <DevisAddVariantDialog {...addVariantDialogProps} />
      <ClientDocumentPreviewDialog
        preview={documentPreview}
        pdfBytesRef={pdfBytesRef}
        onClose={closeDocumentPreview}
      />
    </>
  );
}

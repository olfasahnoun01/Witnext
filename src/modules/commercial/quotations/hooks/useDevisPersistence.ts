import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { clearDevisDraft } from '@/lib/devisDraftStorage';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { SESSION_EXPIRED_USER_MESSAGE } from '@/lib/supabaseSession';
import type { DevisFormCommitOptions } from '@/lib/devisTvaPolicy';
import type { CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import type { Devis, DevisItem } from '@/types';
import type { DevisActiveSection } from '@/lib/appNavigationStorage';
import {
  confirmDevisRecord,
  deleteDevisRecord,
  deleteSuccessMessage,
} from '@/modules/commercial/quotations/services/devisRepository';
import {
  createBcFromDevisSources,
  persistDevisUpdate,
  persistNewDevis,
} from '@/modules/commercial/quotations/services/devisPersistenceService';
import type { DevisDocumentStatus } from '@/modules/commercial/quotations/types/devisFormTypes';

type UseDevisPersistenceArgs = {
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  hasDocumentContent: boolean;
  devisNumberRef: MutableRefObject<string>;
  devisNumber: string;
  setDevisNumber: (v: string) => void;
  devisType: 'achat' | 'vente';
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  devisItems: DevisItem[];
  isTtc: boolean;
  isFodecEnabled: boolean;
  docType: 'devis' | 'bc' | 'ba';
  sectionMode?: 'devis' | 'bc' | 'bl';
  documentStatus: DevisDocumentStatus;
  existingAttachments: CommercialAttachmentRecord[];
  pendingAttachmentFiles: File[];
  importSourceDevisIds: number[];
  editingDevis: Devis | null;
  devisListToConvert: Devis[];
  draftHydratedRef: MutableRefObject<boolean>;
  setPendingAttachmentFiles: (files: File[]) => void;
  setExistingAttachments: (urls: CommercialAttachmentRecord[]) => void;
  setDraftSavedAt: (v: string | null) => void;
  setEditingDevis: (d: Devis | null) => void;
  setActiveSection: Dispatch<SetStateAction<DevisActiveSection>>;
  setIsBCReviewOpen: (open: boolean) => void;
  setDevisListToConvert: (list: Devis[]) => void;
  setBcPromptDevis: (d: Devis | null) => void;
  loadAll: () => Promise<void>;
  clearFormFields: (clearItems?: boolean) => void;
  refreshDevisNumber: (type?: 'achat' | 'vente', mode?: 'devis' | 'bc' | 'ba') => Promise<string>;
  resetForm: () => void;
};

export function useDevisPersistence({
  isSaving,
  setIsSaving,
  hasDocumentContent,
  devisNumberRef,
  devisNumber,
  setDevisNumber,
  devisType,
  devisDate,
  thirdPartyName,
  thirdPartyAddress,
  thirdPartyTaxId,
  thirdPartyPhone,
  notes,
  devisItems,
  isTtc,
  isFodecEnabled,
  docType,
  sectionMode,
  documentStatus,
  existingAttachments,
  pendingAttachmentFiles,
  importSourceDevisIds,
  editingDevis,
  devisListToConvert,
  draftHydratedRef,
  setPendingAttachmentFiles,
  setExistingAttachments,
  setDraftSavedAt,
  setEditingDevis,
  setActiveSection,
  setIsBCReviewOpen,
  setDevisListToConvert,
  setBcPromptDevis,
  loadAll,
  clearFormFields,
  refreshDevisNumber,
  resetForm,
}: UseDevisPersistenceArgs) {
  const saveDevis = useCallback(
    async (commit?: DevisFormCommitOptions, options?: { redirectAfterSave?: boolean }): Promise<boolean> => {
      if (isSaving) return false;
      if (!hasDocumentContent) {
        toast.error("Ajoutez au moins une ligne d'article");
        return false;
      }
      const initialNumber = devisNumberRef.current;
      if (!initialNumber) {
        toast.error('Numéro de devis manquant, veuillez patienter');
        return false;
      }

      const saveAsBc = docType === 'bc' || sectionMode === 'bc';
      setIsSaving(true);
      try {
        const result = await persistNewDevis({
          devisNumber: initialNumber,
          devisType,
          devisDate,
          thirdPartyName,
          thirdPartyAddress,
          thirdPartyTaxId,
          thirdPartyPhone,
          notes,
          devisItems,
          isTtc,
          isFodecEnabled,
          docType,
          saveAsBc,
          documentStatus,
          existingAttachments,
          pendingAttachmentFiles,
          importSourceDevisIds,
          commit,
        });

        if (!result.ok) {
          toast.error(result.message);
          if (result.reason === 'save_failed') console.error(result.message);
          return false;
        }

        if (result.devisNumber !== initialNumber) {
          devisNumberRef.current = result.devisNumber;
          setDevisNumber(result.devisNumber);
        }

        setPendingAttachmentFiles([]);
        setExistingAttachments(result.attachmentUrls);
        clearDevisDraft(result.companyId, devisType, docType);
        setDraftSavedAt(null);
        draftHydratedRef.current = true;

        toast.success(result.saveAsBc ? 'Bon de commande enregistré' : 'Devis sauvegardé');
        await loadAll();
        setEditingDevis(null);
        clearFormFields(true);
        void refreshDevisNumber(devisType, result.saveAsBc ? 'bc' : 'devis');

        if (options?.redirectAfterSave !== false) {
          setActiveSection(result.saveAsBc ? 'bc' : 'history');
        }
        return true;
      } catch (err) {
        console.error(err);
        toast.error('Erreur lors de la sauvegarde');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      hasDocumentContent,
      devisNumberRef,
      docType,
      sectionMode,
      devisType,
      devisDate,
      thirdPartyName,
      thirdPartyAddress,
      thirdPartyTaxId,
      thirdPartyPhone,
      notes,
      devisItems,
      isTtc,
      isFodecEnabled,
      documentStatus,
      existingAttachments,
      pendingAttachmentFiles,
      importSourceDevisIds,
      setDevisNumber,
      draftHydratedRef,
      setPendingAttachmentFiles,
      setExistingAttachments,
      setDraftSavedAt,
      setEditingDevis,
      setActiveSection,
      loadAll,
      clearFormFields,
      refreshDevisNumber,
      setIsSaving,
    ]
  );

  const updateDevis = useCallback(
    async (commit?: DevisFormCommitOptions) => {
      if (isSaving) return;
      if (!editingDevis) return;
      if (!hasDocumentContent) {
        toast.error("Ajoutez au moins une ligne d'article");
        return;
      }

      setIsSaving(true);
      try {
        const result = await persistDevisUpdate({
          editingDevis,
          devisNumber,
          devisType,
          devisDate,
          thirdPartyName,
          thirdPartyAddress,
          thirdPartyTaxId,
          thirdPartyPhone,
          notes,
          devisItems,
          isTtc,
          isFodecEnabled,
          docType,
          documentStatus,
          existingAttachments,
          pendingAttachmentFiles,
          commit,
        });

        if (!result.ok) {
          if (result.reason === 'session_expired') {
            notifySessionInvalid('session expired during devis update');
            toast.error(SESSION_EXPIRED_USER_MESSAGE);
          } else {
            toast.error(`Erreur lors de la mise à jour : ${result.message}`);
          }
          return;
        }

        setPendingAttachmentFiles([]);
        setExistingAttachments(result.attachmentUrls);
        toast.success('Devis mis à jour');
        await loadAll();
        resetForm();
      } catch (err) {
        console.error(err);
        toast.error('Erreur lors de la mise à jour');
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      editingDevis,
      hasDocumentContent,
      devisNumber,
      devisType,
      devisDate,
      thirdPartyName,
      thirdPartyAddress,
      thirdPartyTaxId,
      thirdPartyPhone,
      notes,
      devisItems,
      isTtc,
      isFodecEnabled,
      docType,
      documentStatus,
      existingAttachments,
      pendingAttachmentFiles,
      loadAll,
      resetForm,
      setPendingAttachmentFiles,
      setExistingAttachments,
      setIsSaving,
    ]
  );

  const deleteDevis = useCallback(
    async (devis: Devis) => {
      const result = await deleteDevisRecord(devis.id);
      if (!result.ok) {
        toast.error('Erreur lors de la suppression');
      } else {
        toast.success(deleteSuccessMessage(devis));
        await loadAll();
      }
    },
    [loadAll]
  );

  const confirmDevis = useCallback(
    async (devis: Devis) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const result = await confirmDevisRecord(devis.id, user?.id ?? null);
        if (!result.ok) throw new Error(result.error);
        toast.success(`Devis ${devis.devis_number} confirmé`);
        await loadAll();
        if (devis.type === 'vente') {
          setBcPromptDevis({ ...devis, status: 'confirmé' });
        }
      } catch (err) {
        console.error(err);
        toast.error('Impossible de confirmer le devis');
      }
    },
    [loadAll, setBcPromptDevis]
  );

  const handleConfirmBC = useCallback(
    async (modifiedItems: DevisItem[], bcStatus: DevisDocumentStatus) => {
      if (devisListToConvert.length === 0) return;

      try {
        const result = await createBcFromDevisSources({
          sources: devisListToConvert,
          modifiedItems,
          bcStatus,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(`BC ${result.bcNumber} créé avec succès`);
        setIsBCReviewOpen(false);
        setDevisListToConvert([]);
        await loadAll();
        setActiveSection('bc');
      } catch (err) {
        console.error(err);
        toast.error('Erreur lors de la création');
      }
    },
    [devisListToConvert, loadAll, setActiveSection, setDevisListToConvert, setIsBCReviewOpen]
  );

  return {
    saveDevis,
    updateDevis,
    deleteDevis,
    confirmDevis,
    handleConfirmBC,
  };
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, History, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Devis, DevisItem, BonCommande } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { readStoredDevisSection, writeStoredDevisSection, type DevisActiveSection } from '@/lib/appNavigationStorage';
import {
  clearDevisDraft,
  loadDevisDraft,
  saveDevisDraft,
} from '@/lib/devisDraftStorage';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useDevisFormLeaveGuard } from '@/hooks/useDevisFormLeaveGuard';
import { resolveFodecEnabled } from '@/lib/devisPricing';
import { useDevisDocumentList, useDevisPersistence } from '@/modules/commercial/quotations';
import { parseAttachmentUrls, type CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import { mergeDevisItemsFromSources, validateDevisMergeForBc } from '@/lib/mergeCommercialDocuments';
import { allocateDevisNumber } from '@/lib/devisNumbering';
import { DevisForm } from './devis/DevisForm';
import { DevisHistory } from './devis/DevisHistory';
import { BonCommandeList } from './devis/BonCommandeList';
import { BonLivraisonList } from './devis/BonLivraisonList';
import { BCCreationDialog } from './devis/BCCreationDialog';
import { DevisToSupplierBCDialog } from './devis/DevisToSupplierBCDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GestionDevisProps {
  onTabChange?: (tab: string) => void;
  initialSection?: DevisActiveSection;
  initialDocType?: 'devis' | 'bc' | 'ba';
  initialDevisType?: 'achat' | 'vente';
  lockDevisType?: boolean;
  sectionMode?: 'devis' | 'bc' | 'bl';
}

export const GestionDevis = ({
  onTabChange,
  initialSection = 'form',
  initialDocType = 'devis',
  initialDevisType,
  lockDevisType,
  sectionMode,
}: GestionDevisProps) => {
  const { isAdmin, isModerator, user } = useAuth();
  const canEdit = true;
  const defaultDevisType = initialDevisType ?? 'vente';
  const [activeSection, setActiveSection] = useState<DevisActiveSection>(() => {
    const fallback = (initialSection as string) === 'ba' ? 'form' : (initialSection ?? 'form');
    return readStoredDevisSection(sectionMode, defaultDevisType, fallback);
  });
  const { allDevis, loadAll } = useDevisDocumentList();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [isBCReviewOpen, setIsBCReviewOpen] = useState(false);
  const [devisListToConvert, setDevisListToConvert] = useState<Devis[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<CommercialAttachmentRecord[]>([]);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);
  const [importSourceDevisIds, setImportSourceDevisIds] = useState<number[]>([]);
  const [devisForSupplierBC, setDevisForSupplierBC] = useState<Devis | null>(null);
  const [bcPromptDevis, setBcPromptDevis] = useState<Devis | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [composerDirty, setComposerDirty] = useState(false);
  const draftHydratedRef = useRef(false);
  const currentDraftRef = useRef<any>(null);
  const [docType, setDocType] = useState<'devis' | 'bc' | 'ba'>(() => {
    if (sectionMode === 'bc') return 'bc';
    if ((initialDocType as unknown) === 'ba') return 'ba';
    return initialDocType;
  });
  const devisNumberRef = useRef('');

  // Form state
  const [devisType, setDevisType] = useState<'achat' | 'vente'>(defaultDevisType);
  const [devisNumber, setDevisNumber] = useState('');
  const pageMode = sectionMode ?? (initialSection === 'bc' ? 'bc' : 'devis');
  const [devisDate, setDevisDate] = useState(new Date().toISOString().split('T')[0]);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyAddress, setThirdPartyAddress] = useState('');
  const [thirdPartyTaxId, setThirdPartyTaxId] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [documentStatus, setDocumentStatus] = useState<'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré'>('brouillon');
  const [devisItems, setDevisItems] = useState<DevisItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTtc, setIsTtc] = useState(false);
  const [isFodecEnabled, setIsFodecEnabled] = useState(false);

  // Derived lists
  const savedDevis = useMemo(() => allDevis.filter((d) => d && !d.is_bc && !d.is_ba && !d.is_bl), [allDevis]);
  useEffect(() => {
    writeStoredDevisSection(sectionMode, devisType, activeSection);
  }, [activeSection, sectionMode, devisType]);

  const isDraftEligibleDoc = docType === 'devis' || docType === 'bc';

  const flushDraftToStorage = useCallback(() => {
    if (editingDevis || showEditDialog || !isDraftEligibleDoc) return;
    const companyId = getActiveCompanyId();
    if (currentDraftRef.current) {
      saveDevisDraft(companyId, devisType, docType, currentDraftRef.current);
      setDraftSavedAt(new Date().toISOString());
    } else {
      clearDevisDraft(companyId, devisType, docType);
      setDraftSavedAt(null);
    }
  }, [editingDevis, showEditDialog, isDraftEligibleDoc, devisType, docType]);

  const hasUnsavedFormWork = useMemo(() => {
    if (activeSection !== 'form' || editingDevis || showEditDialog || !isDraftEligibleDoc) {
      return false;
    }
    return (
      devisItems.length > 0 ||
      thirdPartyName.trim().length > 0 ||
      thirdPartyAddress.trim().length > 0 ||
      thirdPartyTaxId.trim().length > 0 ||
      thirdPartyPhone.trim().length > 0 ||
      notes.trim().length > 0 ||
      composerDirty
    );
  }, [
    activeSection,
    editingDevis,
    showEditDialog,
    isDraftEligibleDoc,
    devisItems.length,
    thirdPartyName,
    thirdPartyAddress,
    thirdPartyTaxId,
    thirdPartyPhone,
    notes,
    composerDirty,
  ]);

  const leaveGuard = useDevisFormLeaveGuard({
    enabled: hasUnsavedFormWork,
    onBeforeLeave: flushDraftToStorage,
  });

  const requestSectionChange = useCallback(
    (section: DevisActiveSection) => {
      if (section === activeSection) return;
      leaveGuard.requestLeave(() => setActiveSection(section));
    },
    [activeSection, leaveGuard]
  );

  useEffect(() => {
    if (activeSection !== 'form') {
      setComposerDirty(false);
    }
  }, [activeSection]);

  const prevActiveSectionRef = useRef(activeSection);
  useEffect(() => {
    if (prevActiveSectionRef.current === 'form' && activeSection !== 'form') {
      flushDraftToStorage();
    }
    prevActiveSectionRef.current = activeSection;
  }, [activeSection, flushDraftToStorage]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeSection === 'form') {
        flushDraftToStorage();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeSection, flushDraftToStorage]);

  // Restore local draft for new devis OR new BC forms (not edit dialog).
  useEffect(() => {
    if (editingDevis || showEditDialog || !isDraftEligibleDoc || activeSection !== 'form') return;

    const hasInMemoryContent =
      devisItems.length > 0 ||
      thirdPartyName.trim() ||
      notes.trim() ||
      thirdPartyAddress.trim();

    if (hasInMemoryContent) {
      draftHydratedRef.current = true;
      return;
    }

    if (draftHydratedRef.current) return;

    const companyId = getActiveCompanyId();
    const draft = loadDevisDraft(companyId, devisType, docType);
    if (!draft) {
      draftHydratedRef.current = true;
      return;
    }

    setDevisType(draft.devisType);
    setDevisNumber(draft.devisNumber);
    setDevisDate(draft.devisDate);
    setThirdPartyName(draft.thirdPartyName);
    setThirdPartyAddress(draft.thirdPartyAddress);
    setThirdPartyTaxId(draft.thirdPartyTaxId);
    setThirdPartyPhone(draft.thirdPartyPhone);
    setNotes(draft.notes);
    setDocumentStatus(draft.documentStatus as typeof documentStatus);
    setDevisItems(draft.devisItems);
    setIsTtc(draft.isTtc);
    setIsFodecEnabled(draft.isFodecEnabled ?? false);
    setDraftSavedAt(draft.savedAt);
    draftHydratedRef.current = true;
    toast.info(
      docType === 'bc'
        ? 'Brouillon de bon de commande restauré automatiquement'
        : 'Brouillon de devis restauré automatiquement'
    );
  }, [
    editingDevis,
    showEditDialog,
    docType,
    activeSection,
    devisType,
    isDraftEligibleDoc,
    devisItems.length,
    thirdPartyName,
    notes,
    thirdPartyAddress,
  ]);

  // Update ref whenever form state changes
  useEffect(() => {
    const hasContent =
      devisItems.length > 0 ||
      thirdPartyName.trim() ||
      notes.trim() ||
      thirdPartyAddress.trim();
      
    if (!hasContent) {
      currentDraftRef.current = null;
    } else {
      currentDraftRef.current = {
        devisType,
        docType,
        devisNumber,
        devisDate,
        thirdPartyName,
        thirdPartyAddress,
        thirdPartyTaxId,
        thirdPartyPhone,
        notes,
        documentStatus,
        devisItems,
        isTtc,
        isFodecEnabled,
      };
    }
  }, [
    devisType, docType, devisNumber, devisDate, thirdPartyName, 
    thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, 
    documentStatus, devisItems, isTtc, isFodecEnabled
  ]);

  // Autosave local (devis + BC) — debounced while the create form is open.
  useEffect(() => {
    if (editingDevis || showEditDialog || !isDraftEligibleDoc || activeSection !== 'form') return;
    if (!draftHydratedRef.current && devisItems.length === 0 && !thirdPartyName.trim()) return;

    const companyId = getActiveCompanyId();
    const timer = window.setTimeout(() => {
      flushDraftToStorage();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    editingDevis,
    showEditDialog,
    docType,
    activeSection,
    devisType,
    devisNumber,
    devisDate,
    thirdPartyName,
    thirdPartyAddress,
    thirdPartyTaxId,
    thirdPartyPhone,
    notes,
    documentStatus,
    devisItems,
    isTtc,
    isFodecEnabled,
    isDraftEligibleDoc,
    flushDraftToStorage,
  ]);

  const importableDevisForBc = useMemo(
    () => savedDevis.filter((d) => d && d.type === devisType),
    [savedDevis, devisType]
  );
  const bonsCommande = useMemo(() => allDevis.filter((d) => d && d.is_bc && !d.is_bl), [allDevis]);
  const bonsLivraison = useMemo(() => allDevis.filter((d) => d && d.is_bl), [allDevis]);
  const bonsAchat = useMemo(() => allDevis.filter(d => d && d.is_ba), [allDevis]);
  /** Hide "Liste BC" in nav only on locked Mes Devis pages (vente/achat); keep it on dedicated Liste BC routes (sectionMode bc). */
  const hideListBcTab = Boolean(sectionMode === 'devis' && lockDevisType);

  // Re-sync section when switching between devis / BC / BL routes (same component instance).
  const prevSectionModeRef = useRef(sectionMode);
  useEffect(() => {
    if (prevSectionModeRef.current === sectionMode) return;
    prevSectionModeRef.current = sectionMode;
    const fallback = (initialSection as string) === 'ba' ? 'form' : (initialSection ?? 'form');
    setActiveSection(readStoredDevisSection(sectionMode, defaultDevisType, fallback));
    if (sectionMode === 'bc') setDocType('bc');
    else if (sectionMode === 'devis') setDocType('devis');
    if (initialDevisType) setDevisType(initialDevisType);
  }, [sectionMode, initialSection, initialDevisType, defaultDevisType]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useSessionResumeReload(loadAll);

  // Apply route defaults once on mount only — do not reset section when user is mid-form.
  const routeDefaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (routeDefaultsAppliedRef.current) return;
    routeDefaultsAppliedRef.current = true;
    if (initialSection) setActiveSection(initialSection);
    if (sectionMode === 'bc') setDocType('bc');
    else if (initialDocType) setDocType(initialDocType);
    if (initialDevisType) setDevisType(initialDevisType);
  }, [initialSection, initialDocType, initialDevisType, sectionMode]);

  useEffect(() => { devisNumberRef.current = devisNumber; }, [devisNumber]);

  const refreshDevisNumber = useCallback(
    async (type: 'achat' | 'vente' = devisType, mode: 'devis' | 'bc' | 'ba' = docType === 'ba' ? 'ba' : docType === 'bc' ? 'bc' : 'devis') => {
      try {
        const num = await allocateDevisNumber(type, mode);
        setDevisNumber(num);
        return num;
      } catch (err) {
        console.error('[GestionDevis] number allocation failed:', err);
        toast.error('Impossible de générer un numéro de document');
        return '';
      }
    },
    [devisType, docType]
  );

  useEffect(() => {
    if (!editingDevis && devisItems.length === 0 && !showEditDialog && !isBCReviewOpen) {
      let cancelled = false;
      const mode = docType === 'ba' ? 'ba' : docType === 'bc' ? 'bc' : 'devis';
      void allocateDevisNumber(devisType, mode)
        .then((num) => {
          if (!cancelled) setDevisNumber(num);
        })
        .catch((err) => console.error('[GestionDevis] allocate number:', err));
      return () => {
        cancelled = true;
      };
    }
  }, [devisType, docType, editingDevis, devisItems.length, showEditDialog, isBCReviewOpen]);

  const clearFormFields = useCallback((clearItems = true) => {
    setDevisDate(new Date().toISOString().split('T')[0]);
    setThirdPartyName('');
    setThirdPartyAddress('');
    setThirdPartyTaxId('');
    setThirdPartyPhone('');
    setNotes('');
    setDocumentStatus('brouillon');
    if (clearItems) setDevisItems([]);
    setIsTtc(false);
    setIsFodecEnabled(false);
    setExistingAttachments([]);
    setPendingAttachmentFiles([]);
    setImportSourceDevisIds([]);
    clearDevisDraft(getActiveCompanyId(), devisType, docType);
    setDraftSavedAt(null);
    draftHydratedRef.current = false;
  }, [devisType, docType]);

  const resetForm = useCallback(() => {
    setDevisType(defaultDevisType);
    setDocType('devis');
    clearFormFields(true);
    setEditingDevis(null);
    setShowEditDialog(false);
    void refreshDevisNumber(defaultDevisType, 'devis');
  }, [clearFormFields, defaultDevisType, refreshDevisNumber]);

  const handleCompanyChange = useCallback(() => {
    if (showEditDialog || editingDevis) {
      resetForm();
    }
    void loadAll();
  }, [showEditDialog, editingDevis, resetForm, loadAll]);

  useCompanyChangeReload(handleCompanyChange);

  const clearInputsOnly = useCallback(() => {
    clearFormFields(true);
    setEditingDevis(null);
    void refreshDevisNumber(devisType, docType === 'ba' ? 'ba' : docType === 'bc' ? 'bc' : 'devis');
  }, [clearFormFields, refreshDevisNumber, devisType, docType]);

  const handleTypeChange = useCallback((type: 'achat' | 'vente') => {
    setDevisType(type);
    clearFormFields();
  }, [clearFormFields]);

  const isBcForm = docType === 'bc' || sectionMode === 'bc';

  const importDevisIntoBcForm = useCallback((list: Devis[]) => {
    if (list.length === 0) return;
    if (list.length > 1) {
      const check = validateDevisMergeForBc(list);
      if (!check.ok) {
        toast.error((check as any).error);
        return;
      }
    }
    const primary = list[0];
    const importedItems =
      list.length > 1
        ? mergeDevisItemsFromSources(list)
        : JSON.parse(JSON.stringify(primary.items ?? []));
    if (importedItems.length === 0) {
      toast.error('Ce devis ne contient aucune ligne à importer');
      return;
    }
    if (docType !== 'bc') setDocType('bc');
    setThirdPartyName(primary.third_party_name || '');
    setThirdPartyAddress(primary.third_party_address || '');
    setThirdPartyTaxId(primary.third_party_tax_id || '');
    setThirdPartyPhone(primary.third_party_phone || '');
    setIsTtc(primary.is_ttc ?? false);
    setDevisItems(importedItems);
    if (!notes.trim() && primary.notes) setNotes(primary.notes);
    setImportSourceDevisIds(list.map((d) => d.id));
    toast.success(
      list.length > 1
        ? `${list.length} devis importés dans le bon de commande`
        : `Devis ${primary.devis_number} importé`
    );
  }, [notes, docType]);

  const hasDocumentContent = devisItems.length > 0;

  const { saveDevis, updateDevis, deleteDevis, confirmDevis, handleConfirmBC } = useDevisPersistence({
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
  });

  const convertToBC = useCallback((devis: Devis) => {
    setDevisListToConvert([devis]);
    setIsBCReviewOpen(true);
  }, []);

  const convertMultipleToBC = useCallback((list: Devis[]) => {
    const check = validateDevisMergeForBc(list);
    if (!check.ok) {
      toast.error((check as any).error);
      return;
    }
    setDevisListToConvert(list);
    setIsBCReviewOpen(true);
  }, []);

  const convertToBCFournisseur = useCallback((devis: Devis) => {
    setDevisForSupplierBC(devis);
  }, []);

  const startEdit = useCallback((d: Devis) => {
    setEditingDevis(d);
    setDevisType(d.type as 'achat' | 'vente');
    if (d.is_ba) setDocType('ba');
    else if (d.is_bc || d.is_bl) setDocType('bc');
    else setDocType('devis');
    
    setDevisNumber(d.devis_number);
    setDevisDate(d.devis_date);
    setThirdPartyName(d.third_party_name || '');
    setThirdPartyAddress(d.third_party_address || '');
    setThirdPartyTaxId(d.third_party_tax_id || '');
    setThirdPartyPhone(d.third_party_phone || '');
    setNotes(d.notes || '');
    setDocumentStatus(d.status || 'brouillon');
    setDevisItems(d.items);
    setIsTtc(d.is_ttc ?? false);
    setIsFodecEnabled(resolveFodecEnabled({
      devisType: d.type as 'achat' | 'vente',
      items: d.items,
    }));
    setExistingAttachments(parseAttachmentUrls(d.attachment_urls));
    setPendingAttachmentFiles([]);
    setShowEditDialog(true);
  }, []);

  const handleAddNew = useCallback((mode: 'devis' | 'bc' | 'ba') => {
    setEditingDevis(null);
    setShowEditDialog(false);
    draftHydratedRef.current = true;
    clearFormFields(true);
    setDevisType(defaultDevisType);
    setDocType(mode);
    void refreshDevisNumber(defaultDevisType, mode);
    setActiveSection('form');
  }, [clearFormFields, defaultDevisType, refreshDevisNumber]);

  const accentIsAchat = (lockDevisType ? defaultDevisType : devisType) === 'achat';
  const tabActiveClass = accentIsAchat
    ? 'bg-orange-600 text-white shadow-md'
    : 'bg-emerald-600 text-white shadow-md';
  const tabBarClass = accentIsAchat ? 'bg-orange-500/10' : 'bg-emerald-500/10';

  const leaveGuardDialog = (
    <AlertDialog open={leaveGuard.dialogOpen} onOpenChange={(open) => !open && leaveGuard.cancelLeave()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
          <AlertDialogDescription>
            Vous avez un {docType === 'bc' ? 'bon de commande' : 'devis'} en cours de saisie.
            Enregistrez-le sur le serveur avant de quitter, ou quittez en conservant le brouillon
            local automatique.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            className="w-full sm:w-full"
            disabled={isSaving}
            onClick={(e) => {
              e.preventDefault();
              void (async () => {
                const ok = await saveDevis(undefined, { redirectAfterSave: false });
                if (ok) leaveGuard.confirmLeave();
              })();
            }}
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer et quitter'}
          </AlertDialogAction>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={leaveGuard.confirmLeave}
          >
            Quitter sans enregistrer
          </Button>
          <AlertDialogCancel className="w-full mt-0" onClick={leaveGuard.cancelLeave}>
            Rester sur le formulaire
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (sectionMode === 'bl') {
    return (
      <div className="space-y-6 animate-fade-in">
        <BonLivraisonList
          bonsLivraison={bonsLivraison}
          currentUserId={user?.id || null}
          isAdminOrMod={isAdmin || isModerator}
          onEdit={startEdit}
          onDelete={deleteDevis}
          onRefresh={loadAll}
        />
        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-auto p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Modifier BL {editingDevis?.devis_number}</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-2">
              {editingDevis && (
                <DevisForm
                  devisType={devisType}
                  devisNumber={devisNumber}
                  devisDate={devisDate}
                  thirdPartyName={thirdPartyName}
                  thirdPartyAddress={thirdPartyAddress}
                  thirdPartyTaxId={thirdPartyTaxId}
                  thirdPartyPhone={thirdPartyPhone}
                  notes={notes}
                  devisItems={devisItems}
                  editingDevis={editingDevis}
                  isSaving={isSaving}
                  isTtc={isTtc}
                  isFodecEnabled={isFodecEnabled}
                  docType="bc"
                  setDocType={setDocType}
                  setDevisType={handleTypeChange}
                  setDevisNumber={setDevisNumber}
                  setDevisDate={setDevisDate}
                  setThirdPartyName={setThirdPartyName}
                  setThirdPartyAddress={setThirdPartyAddress}
                  setThirdPartyTaxId={setThirdPartyTaxId}
                  setThirdPartyPhone={setThirdPartyPhone}
                  setNotes={setNotes}
                  documentStatus={documentStatus}
                  setDocumentStatus={setDocumentStatus}
                  setDevisItems={setDevisItems}
                  setIsTtc={setIsTtc}
                  setIsFodecEnabled={setIsFodecEnabled}
                  onSave={saveDevis}
                  onUpdate={updateDevis}
                  onCancel={resetForm}
                  lockDevisType={lockDevisType}
                  existingAttachments={existingAttachments}
                  pendingAttachmentFiles={pendingAttachmentFiles}
                  onPendingAttachmentFilesChange={setPendingAttachmentFiles}
                  onRemoveExistingAttachment={(index) =>
                    setExistingAttachments((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
        {leaveGuardDialog}
      </div>
    );
  }

  const formTabLabel = editingDevis
    ? 'Modifier'
    : sectionMode === 'bc'
      ? 'Nouveau BC'
      : sectionMode === 'devis'
        ? 'Nouveau devis'
        : 'Créer';
  const formTabTitle = editingDevis
    ? 'Modifier le document en cours'
    : sectionMode === 'bc'
      ? 'Créer un bon de commande'
      : sectionMode === 'devis'
        ? 'Créer un devis'
        : 'Créer un document';

  const sectionTabClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0',
      active ? tabActiveClass : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
    );

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Section tabs — compact bar to maximize form/list area */}
      <div className={cn('inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg max-w-full', tabBarClass)}>
        <Button
          variant={activeSection === 'form' ? 'default' : 'ghost'}
          onClick={() => {
            if (activeSection !== 'form') {
              setActiveSection('form');
            } else if (!editingDevis) {
              if (window.confirm("Créer un nouveau devis et effacer le brouillon actuel ?")) {
                handleAddNew(sectionMode ?? 'devis');
              }
            } else {
              setActiveSection('form');
            }
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${activeSection === 'form' ? tabActiveClass : 'text-muted-foreground hover:text-foreground hover:bg-background/60'}`}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          {formTabLabel}
        </Button>
        <button
          type="button"
          title="Liste des devis"
          onClick={() => requestSectionChange('history')}
          className={sectionTabClass(activeSection === 'history')}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          Devis
          <span className="tabular-nums opacity-80">({savedDevis.length})</span>
        </button>
        {!hideListBcTab && (
          <button
            type="button"
            title="Liste des bons de commande"
            onClick={() => requestSectionChange('bc')}
            className={sectionTabClass(activeSection === 'bc')}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            BC
            <span className="tabular-nums opacity-80">({bonsCommande.length})</span>
          </button>
        )}
      </div>

      {activeSection === 'form' && devisNumber && (
        <DevisForm
          devisType={devisType}
          devisNumber={devisNumber}
          devisDate={devisDate}
          thirdPartyName={thirdPartyName}
          thirdPartyAddress={thirdPartyAddress}
          thirdPartyTaxId={thirdPartyTaxId}
          thirdPartyPhone={thirdPartyPhone}
          notes={notes}
          devisItems={devisItems}
          editingDevis={editingDevis}
          isSaving={isSaving}
          isTtc={isTtc}
          isFodecEnabled={isFodecEnabled}
          docType={docType}
          setDocType={setDocType}
          setDevisType={handleTypeChange}
          setDevisNumber={setDevisNumber}
          setDevisDate={setDevisDate}
          setThirdPartyName={setThirdPartyName}
          setThirdPartyAddress={setThirdPartyAddress}
          setThirdPartyTaxId={setThirdPartyTaxId}
          setThirdPartyPhone={setThirdPartyPhone}
          setNotes={setNotes}
          documentStatus={documentStatus}
          setDocumentStatus={setDocumentStatus}
          setDevisItems={setDevisItems}
          setIsTtc={setIsTtc}
          setIsFodecEnabled={setIsFodecEnabled}
          draftSavedAt={draftSavedAt}
          onSave={saveDevis}
          onUpdate={updateDevis}
          onCancel={editingDevis ? resetForm : clearInputsOnly}
          lockDevisType={lockDevisType}
          forceDocType={sectionMode}
          existingAttachments={existingAttachments}
          pendingAttachmentFiles={pendingAttachmentFiles}
          onPendingAttachmentFilesChange={setPendingAttachmentFiles}
          onRemoveExistingAttachment={(index) =>
            setExistingAttachments((prev) => prev.filter((_, i) => i !== index))
          }
          importableDevis={isBcForm ? importableDevisForBc : []}
          onImportDevis={isBcForm ? importDevisIntoBcForm : undefined}
          onComposerDirtyChange={setComposerDirty}
        />
      )}

      {activeSection === 'history' && (
        <DevisHistory
          savedDevis={savedDevis}
          canEdit={canEdit}
          currentUserId={user?.id || null}
          isAdminOrMod={isAdmin || isModerator}
          onEdit={startEdit}
          onDelete={deleteDevis}
          onConvertToBC={convertToBC}
          onConvertMultipleToBC={convertMultipleToBC}
          onConvertToBCFournisseur={initialDevisType === 'vente' ? convertToBCFournisseur : undefined}
          onConfirmDevis={confirmDevis}
          onAdd={() => handleAddNew(sectionMode ?? 'devis')}
          defaultTypeFilter={initialDevisType ?? 'all'}
        />
      )}

      {activeSection === 'bc' && (
        <BonCommandeList
          bonsCommande={bonsCommande}
          currentUserId={user?.id || null}
          isAdminOrMod={isAdmin || isModerator}
          onEdit={startEdit}
          onDelete={deleteDevis}
          onAdd={() => handleAddNew('bc')}
          onRefresh={loadAll}
          showAddButton={false}
          defaultTypeFilter={initialDevisType ?? 'vente'}
        />
      )}

      {/* Edit Devis Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Modifier Devis {editingDevis?.devis_number}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            {editingDevis && (
              <DevisForm
                devisType={devisType}
                devisNumber={devisNumber}
                devisDate={devisDate}
                thirdPartyName={thirdPartyName}
                thirdPartyAddress={thirdPartyAddress}
                thirdPartyTaxId={thirdPartyTaxId}
                thirdPartyPhone={thirdPartyPhone}
                notes={notes}
                devisItems={devisItems}
                editingDevis={editingDevis}
                isSaving={isSaving}
                isTtc={isTtc}
                isFodecEnabled={isFodecEnabled}
                docType={docType}
                setDocType={setDocType}
                setDevisType={handleTypeChange}
                setDevisNumber={setDevisNumber}
                setDevisDate={setDevisDate}
                setThirdPartyName={setThirdPartyName}
                setThirdPartyAddress={setThirdPartyAddress}
                setThirdPartyTaxId={setThirdPartyTaxId}
                setThirdPartyPhone={setThirdPartyPhone}
                setNotes={setNotes}
                documentStatus={documentStatus}
                setDocumentStatus={setDocumentStatus}
                setDevisItems={setDevisItems}
                setIsTtc={setIsTtc}
                setIsFodecEnabled={setIsFodecEnabled}
                onSave={saveDevis}
                onUpdate={updateDevis}
                onCancel={resetForm}
                lockDevisType={lockDevisType}
                existingAttachments={existingAttachments}
                pendingAttachmentFiles={pendingAttachmentFiles}
                onPendingAttachmentFilesChange={setPendingAttachmentFiles}
                onRemoveExistingAttachment={(index) =>
                  setExistingAttachments((prev) => prev.filter((_, i) => i !== index))
                }
                importableDevis={isBcForm ? importableDevisForBc : []}
                onImportDevis={isBcForm ? importDevisIntoBcForm : undefined}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BCCreationDialog
        open={isBCReviewOpen}
        onOpenChange={(open) => {
          setIsBCReviewOpen(open);
          if (!open) setDevisListToConvert([]);
        }}
        sourceDevisList={devisListToConvert}
        onConfirm={handleConfirmBC}
      />

      <DevisToSupplierBCDialog
        open={!!devisForSupplierBC}
        onOpenChange={(open) => !open && setDevisForSupplierBC(null)}
        devis={devisForSupplierBC}
        onSuccess={() => {
          loadAll();
        }}
      />

      <AlertDialog open={!!bcPromptDevis} onOpenChange={(open) => !open && setBcPromptDevis(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {bcPromptDevis?.devis_number} est confirmé. Voulez-vous créer un bon de commande
              maintenant ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Plus tard</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bcPromptDevis) convertToBC(bcPromptDevis);
                setBcPromptDevis(null);
              }}
            >
              Créer un BC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {leaveGuardDialog}

    </div>
  );
};

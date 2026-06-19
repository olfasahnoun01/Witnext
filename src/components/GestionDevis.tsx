import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, History, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Devis, DevisItem, BonCommande } from '@/types';
import { buildProfilesMap, collectUserIdsForProfiles } from '@/lib/documentListAudit';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { readStoredDevisSection, writeStoredDevisSection } from '@/lib/appNavigationStorage';
import {
  clearDevisDraft,
  loadDevisDraft,
  saveDevisDraft,
} from '@/lib/devisDraftStorage';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { debugLog } from '@/lib/debugLog';
import { computeDevisTotals } from '@/lib/devisPricing';
import { parseAttachmentUrls, uploadCommercialAttachments, type CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import { buildMergedBcNotes, mergeDevisItemsFromSources, validateDevisMergeForBc } from '@/lib/mergeCommercialDocuments';
import { ensureSuiviFromDevis } from '@/lib/partiesSuivi';
import {
  ensureSupabaseSessionReady,
  isAuthSessionError,
  isJwtExpiredError,
  SESSION_EXPIRED_USER_MESSAGE,
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';
import { DevisForm } from './devis/DevisForm';
import { DevisHistory } from './devis/DevisHistory';
import { BonCommandeList } from './devis/BonCommandeList';
import { BonLivraisonList } from './devis/BonLivraisonList';
import { DevisHelper } from './devis/DevisHelper';
import { BCCreationDialog } from './devis/BCCreationDialog';
import { DevisToSupplierBCDialog } from './devis/DevisToSupplierBCDialog';
import { documentService } from '@/services/documentService';
import { createDossierForBc } from '@/modules/flux/services/dossierRepository';
import { notifyDossierCreated } from '@/modules/flux/services/dossierNotifications';
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

const parseDevisRow = (
  d: any,
  profilesMap: Record<string, string>,
  sourceDevisMap?: Record<number, string>,
  sourceBcMap?: Record<number, string>
): Devis => {
  let parsedItems: DevisItem[] = [];
  if (d.items) {
    if (typeof d.items === 'string') {
      try { parsedItems = JSON.parse(d.items); } catch { parsedItems = []; }
    } else if (Array.isArray(d.items)) {
      parsedItems = d.items as unknown as DevisItem[];
    }
  }
  return {
    ...d,
    type: d.type as 'achat' | 'vente',
    status: d.status as 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré',
    items: parsedItems,
    total_amount: Number(d.total_amount) || 0,
    is_bc: d.is_bc ?? false,
    is_ba: d.is_ba ?? false,
    is_bl: d.is_bl ?? false,
    source_devis_id: d.source_devis_id ?? null,
    source_bc_id: d.source_bc_id ?? null,
    source_bc_ids: Array.isArray(d.source_bc_ids)
      ? (d.source_bc_ids as number[]).filter((id) => typeof id === 'number')
      : null,
    source_bc_number: (() => {
      const multi = Array.isArray(d.source_bc_ids)
        ? (d.source_bc_ids as number[])
            .map((id) => sourceBcMap?.[id])
            .filter(Boolean)
            .join(', ')
        : '';
      if (multi) return multi;
      return d.source_bc_id && sourceBcMap ? sourceBcMap[d.source_bc_id] || null : null;
    })(),
    creator_name: d.created_by ? (profilesMap[d.created_by] || null) : null,
    updated_by: d.updated_by ?? null,
    modifier_name: d.updated_by ? (profilesMap[d.updated_by] || null) : null,
    source_devis_number: (() => {
      const multi = Array.isArray(d.source_devis_ids)
        ? (d.source_devis_ids as number[])
            .map((id) => sourceDevisMap?.[id])
            .filter(Boolean)
            .join(', ')
        : '';
      if (multi) return multi;
      return d.source_devis_id && sourceDevisMap ? sourceDevisMap[d.source_devis_id] || null : null;
    })(),
    source_devis_ids: Array.isArray(d.source_devis_ids)
      ? (d.source_devis_ids as number[]).filter((id) => typeof id === 'number')
      : null,
    attachment_urls: parseAttachmentUrls(d.attachment_urls),
  };
};

interface GestionDevisProps {
  onTabChange?: (tab: string) => void;
  initialSection?: 'form' | 'history' | 'bc' | 'bl' | 'helper';
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
  const [activeSection, setActiveSection] = useState<'form' | 'history' | 'bc' | 'bl' | 'helper'>(() => {
    const fallback = (initialSection as string) === 'ba' ? 'form' : initialSection;
    return readStoredDevisSection(sectionMode, defaultDevisType, fallback);
  });
  const [allDevis, setAllDevis] = useState<Devis[]>([]);
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

  // Derived lists
  const savedDevis = useMemo(() => allDevis.filter((d) => !d.is_bc && !d.is_ba && !d.is_bl), [allDevis]);
  useEffect(() => {
    writeStoredDevisSection(sectionMode, devisType, activeSection);
  }, [activeSection, sectionMode, devisType]);

  useEffect(() => {
    if (draftHydratedRef.current || editingDevis || showEditDialog) return;
    if (docType !== 'devis' || activeSection !== 'form') return;

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
    setDraftSavedAt(draft.savedAt);
    draftHydratedRef.current = true;
    toast.info('Brouillon de devis restauré automatiquement');
  }, [
    editingDevis,
    showEditDialog,
    docType,
    activeSection,
    devisType,
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
      };
    }
  }, [
    devisType, docType, devisNumber, devisDate, thirdPartyName, 
    thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, 
    documentStatus, devisItems, isTtc
  ]);

  // Handle synchronous save on unmount or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (editingDevis || showEditDialog || docType !== 'devis' || activeSection !== 'form') return;
      const companyId = getActiveCompanyId();
      if (currentDraftRef.current) {
        saveDevisDraft(companyId, devisType, docType, currentDraftRef.current);
      } else {
        clearDevisDraft(companyId, devisType, docType);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [editingDevis, showEditDialog, docType, activeSection, devisType]);

  // Existing debounce save
  useEffect(() => {
    if (editingDevis || showEditDialog || docType !== 'devis' || activeSection !== 'form') return;
    if (!draftHydratedRef.current && devisItems.length === 0 && !thirdPartyName.trim()) return;

    const companyId = getActiveCompanyId();
    const timer = window.setTimeout(() => {
      if (!currentDraftRef.current) {
        clearDevisDraft(companyId, devisType, docType);
        setDraftSavedAt(null);
        return;
      }
      saveDevisDraft(companyId, devisType, docType, currentDraftRef.current);
      setDraftSavedAt(new Date().toISOString());
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
  ]);

  const importableDevisForBc = useMemo(
    () => savedDevis.filter((d) => d.type === devisType),
    [savedDevis, devisType]
  );
  const bonsCommande = useMemo(() => allDevis.filter((d) => d.is_bc && !d.is_bl), [allDevis]);
  const bonsLivraison = useMemo(() => allDevis.filter((d) => d.is_bl), [allDevis]);
  const bonsAchat = useMemo(() => allDevis.filter(d => d.is_ba), [allDevis]);
  /** Hide "Liste BC" in nav only on locked Mes Devis pages (vente/achat); keep it on dedicated Liste BC routes (sectionMode bc). */
  const hideListBcTab = Boolean(sectionMode === 'devis' && lockDevisType);

  const loadAll = useCallback(async () => {
    const ready = await ensureSupabaseSessionReady();
    debugLog('GestionDevis.tsx:loadAll', 'session ready check', { ready }, 'B');
    if (!ready) {
      notifySessionInvalid('Session expirée lors du chargement des devis');
      toast.error(SESSION_EXPIRED_USER_MESSAGE);
      return;
    }

    const activeCompanyId = getActiveCompanyId();
    const { data, error } = await supabaseQueryWithAuthRetry(async () => {
      let q: any = supabase.from('devis').select('*');
      if (activeCompanyId) q = q.eq('company_id' as any, activeCompanyId);
      return await q.order('created_at', { ascending: false }).limit(1000);
    });

    if (error) {
      debugLog('GestionDevis.tsx:loadAll', 'devis query error', {
        isJwt: isJwtExpiredError(error.message),
        isAuth: isAuthSessionError(error.message),
        errorMsg: error.message?.slice(0, 80),
      }, 'E');
      toast.error(
        isJwtExpiredError(error.message) || isAuthSessionError(error.message)
          ? SESSION_EXPIRED_USER_MESSAGE
          : `Impossible de charger les documents : ${error.message}`
      );
      return;
    }

    debugLog('GestionDevis.tsx:loadAll', 'devis query success', {
      rowCount: (data as any[])?.length ?? 0,
    }, 'C');

    if (data) {
      const dataArr = data as any[];
      const userIds = collectUserIdsForProfiles(dataArr);
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseQueryWithAuthRetry(async () =>
          await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds)
        );
        if (profilesError) {
          console.warn('[GestionDevis] profiles load failed:', profilesError.message);
        } else if (profiles) {
          profilesMap = buildProfilesMap(profiles as any[]);
        }
      }

      const sourceIds = [
        ...new Set(
          dataArr.flatMap((d) => {
            const ids: number[] = [];
            if ((d as { source_devis_id?: number }).source_devis_id) {
              ids.push((d as { source_devis_id: number }).source_devis_id);
            }
            const multi = (d as { source_devis_ids?: number[] }).source_devis_ids;
            if (Array.isArray(multi)) ids.push(...multi.filter((id) => typeof id === 'number'));
            return ids;
          })
        ),
      ] as number[];
      let sourceDevisMap: Record<number, string> = {};
      const sourceBcMap: Record<number, string> = {};
      if (sourceIds.length > 0) {
        dataArr.forEach((d) => {
          if (sourceIds.includes(d.id)) {
            sourceDevisMap[d.id] = d.devis_number;
          }
        });
      }
      dataArr.forEach((d) => {
        if ((d as { is_bc?: boolean }).is_bc) {
          sourceBcMap[d.id] = d.devis_number;
        }
      });

      setAllDevis(dataArr.map((d) => parseDevisRow(d, profilesMap, sourceDevisMap, sourceBcMap)));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useSessionResumeReload(loadAll);
  useCompanyChangeReload(loadAll);

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

  const generateNextNumber = useCallback((type: 'achat' | 'vente', mode: 'devis' | 'bc' | 'ba' = 'devis') => {
    let prefix = 'DE';
    if (mode === 'bc') {
      prefix = type === 'achat' ? 'BCE' : 'BCS';
    } else if (mode === 'ba') {
      prefix = 'BA';
    } else {
      prefix = type === 'achat' ? 'DE' : 'DS';
    }
    
    let list = savedDevis;
    if (mode === 'bc') list = bonsCommande;
    if (mode === 'ba') list = bonsAchat;

    const docsOfType = list.filter(d => d.type === type);
    let maxNum = 0;
    docsOfType.forEach(d => {
      const match = d.devis_number.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });
    return `${prefix}-${(maxNum + 1).toString().padStart(2, '0')}`;
  }, [savedDevis, bonsCommande, bonsAchat]);

  useEffect(() => {
    if (!editingDevis && devisItems.length === 0 && !showEditDialog && !isBCReviewOpen) {
      setDevisNumber(generateNextNumber(devisType, docType));
    }
  }, [allDevis, devisType, docType, editingDevis, devisItems.length, showEditDialog, isBCReviewOpen, generateNextNumber]);

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
    setExistingAttachments([]);
    setPendingAttachmentFiles([]);
    setImportSourceDevisIds([]);
    clearDevisDraft(getActiveCompanyId(), devisType, docType);
    setDraftSavedAt(null);
  }, [devisType, docType]);

  const resetForm = useCallback(() => {
    setDevisType(defaultDevisType);
    setDocType('devis');
    clearFormFields(true);
    setEditingDevis(null);
    setShowEditDialog(false);
    setDevisNumber(generateNextNumber(defaultDevisType, 'devis'));
  }, [clearFormFields, defaultDevisType, generateNextNumber]);

  const clearInputsOnly = useCallback(() => {
    clearFormFields(true);
    setDevisNumber(generateNextNumber(devisType, docType));
  }, [clearFormFields, generateNextNumber, devisType, docType]);

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

  const saveDevis = useCallback(async () => {
    if (isSaving) return;
    if (!hasDocumentContent) {
      toast.error('Ajoutez au moins une ligne d\'article');
      return;
    }
    const currentDevisNumber = devisNumberRef.current;
    if (!currentDevisNumber) {
      toast.error('Numéro de devis manquant, veuillez patienter');
      return;
    }
    const saveAsBc = docType === 'bc' || sectionMode === 'bc';
    setIsSaving(true);
    try {
      const totals = computeDevisTotals(devisItems, false);
      const totalAmount = totals.totalTTC;
      const { data: { user } } = await supabase.auth.getUser();

      const folderKind = saveAsBc ? 'bc' : 'devis';
      const { data: inserted, error } = await supabase.from('devis').insert({
        type: devisType,
        company_id: getActiveCompanyId() || undefined,
        devis_number: currentDevisNumber,
        devis_date: devisDate,
        third_party_name: thirdPartyName || null,
        third_party_address: thirdPartyAddress || null,
        third_party_tax_id: thirdPartyTaxId || null,
        third_party_phone: thirdPartyPhone || null,
        items: JSON.parse(JSON.stringify(devisItems)),
        total_amount: totalAmount,
        notes: notes || null,
        created_by: user?.id,
        is_ttc: isTtc,
        is_bc: saveAsBc,
        is_ba: false,
        status: saveAsBc ? documentStatus : 'brouillon',
        attachment_urls: existingAttachments,
        source_devis_id:
          saveAsBc && importSourceDevisIds.length > 0 ? importSourceDevisIds[0] : null,
        source_devis_ids:
          saveAsBc && importSourceDevisIds.length > 1 ? importSourceDevisIds : null,
      } as any).select('id').single();

      if (error || !inserted) {
        toast.error('Erreur lors de la sauvegarde');
        console.error(error);
      } else {
        const docId = (inserted as { id: number }).id;
        if (pendingAttachmentFiles.length > 0) {
          const uploaded = await uploadCommercialAttachments(
            pendingAttachmentFiles,
            `${folderKind}/${docId}`
          );
          const merged = [...existingAttachments, ...uploaded];
          await supabase.from('devis').update({ attachment_urls: merged } as never).eq('id', docId);
        }

        if (!saveAsBc && (devisType === 'vente' || devisType === 'achat')) {
          await ensureSuiviFromDevis(
            {
              type: devisType,
              devis_number: currentDevisNumber,
              devis_date: devisDate,
              third_party_name: thirdPartyName || null,
              third_party_phone: thirdPartyPhone || null,
            },
            user?.id ?? null
          );
        }

        toast.success(saveAsBc ? 'Bon de commande enregistré' : 'Devis sauvegardé');
        await loadAll();
        clearFormFields();
        if (saveAsBc) {
          setActiveSection('bc');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, hasDocumentContent, devisType, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, docType, sectionMode, documentStatus, existingAttachments, pendingAttachmentFiles, importSourceDevisIds, loadAll, clearFormFields]);

  const updateDevis = useCallback(async () => {
    if (!editingDevis) return;
    if (!hasDocumentContent) {
      toast.error('Ajoutez au moins une ligne d\'article');
      return;
    }
    const totals = computeDevisTotals(devisItems, false);
    const totalAmount = totals.totalTTC;
    const folderKind = docType === 'bc' || editingDevis.is_bc ? 'bc' : 'devis';

    let attachmentUrls = existingAttachments;
    if (pendingAttachmentFiles.length > 0) {
      const uploaded = await uploadCommercialAttachments(
        pendingAttachmentFiles,
        `${folderKind}/${editingDevis.id}`
      );
      attachmentUrls = [...existingAttachments, ...uploaded];
    }

    const { error } = await supabase.from('devis').update({
      type: devisType,
      devis_number: devisNumber,
      devis_date: devisDate,
      third_party_name: thirdPartyName || null,
      third_party_address: thirdPartyAddress || null,
      third_party_tax_id: thirdPartyTaxId || null,
      third_party_phone: thirdPartyPhone || null,
      items: JSON.parse(JSON.stringify(devisItems)),
      total_amount: totalAmount,
      notes: notes || null,
      is_ttc: isTtc,
      is_bc: editingDevis.is_bc && !editingDevis.is_bl,
      is_bl: editingDevis.is_bl ?? false,
      is_ba: false,
      status: docType === 'bc' ? documentStatus : editingDevis.status,
      attachment_urls: attachmentUrls,
    } as any).eq('id', editingDevis.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Devis mis à jour');
      resetForm();
      loadAll();
    }
  }, [editingDevis, hasDocumentContent, docType, devisType, devisNumber, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, documentStatus, existingAttachments, pendingAttachmentFiles, loadAll, resetForm]);

  const deleteDevis = useCallback(async (devis: Devis) => {
    const { error } = await supabase.from('devis').delete().eq('id', devis.id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      let msg = 'Devis supprimé';
      if (devis.is_bl) msg = 'Bon de livraison supprimé';
      else if (devis.is_bc) msg = 'Bon de commande supprimé';
      toast.success(msg);
      loadAll();
    }
  }, [loadAll]);

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

  const confirmDevis = useCallback(async (devis: Devis) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('devis').update({
        status: 'confirmé',
        updated_by: user?.id ?? null,
      } as never).eq('id', devis.id);
      if (error) throw error;
      toast.success(`Devis ${devis.devis_number} confirmé`);
      await loadAll();
      if (devis.type === 'vente') {
        setBcPromptDevis({ ...devis, status: 'confirmé' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Impossible de confirmer le devis');
    }
  }, [loadAll]);

  const handleConfirmBC = useCallback(async (modifiedItems: DevisItem[], bcStatus: 'brouillon' | 'envoyé' | 'confirmé') => {
    if (devisListToConvert.length === 0) return;

    const sources = devisListToConvert;
    const primary = sources[0];
    const isMerge = sources.length > 1;

    const primaryIsTtc = primary.is_ttc ?? false;

    try {
      const bcNumber = generateNextNumber(primary.type as 'achat' | 'vente', 'bc');
      const { data: { user } } = await supabase.auth.getUser();
      const totals = computeDevisTotals(modifiedItems, false);
      const mergedAttachments = sources.flatMap((d) => parseAttachmentUrls(d.attachment_urls));

      const { data: insertedBc, error } = await supabase.from('devis').insert({
        devis_number: bcNumber,
        company_id: getActiveCompanyId() || undefined,
        devis_date: new Date().toISOString().split('T')[0],
        source_devis_id: primary.id,
        source_devis_ids: isMerge ? sources.map((d) => d.id) : null,
        type: primary.type as 'achat' | 'vente',
        third_party_name: primary.third_party_name,
        third_party_address: primary.third_party_address,
        third_party_tax_id: primary.third_party_tax_id,
        third_party_phone: primary.third_party_phone,
        items: JSON.parse(JSON.stringify(modifiedItems)),
        total_amount: totals.totalTTC,
        notes: isMerge ? buildMergedBcNotes(sources) : primary.notes,
        is_ttc: primaryIsTtc,
        is_bc: true,
        created_by: user?.id,
        status: bcStatus,
        attachment_urls: mergedAttachments,
      } as any).select('id').single();

      if (error) {
        toast.error('Erreur lors de la création du BC');
        console.error(error);
      } else {
        const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        for (const src of sources) {
          await documentService.appendLegacyDevisNote(
            src.id,
            `[${stamp}] BC client créé : ${bcNumber} (le devis reste dans la liste).`
          );
        }
        const companyId = getActiveCompanyId();
        if (companyId && primary.type === 'vente' && insertedBc?.id) {
          try {
            const dossier = await createDossierForBc({
              companyId,
              anchorBcDevisId: insertedBc.id,
              clientName: primary.third_party_name,
              anchorDevisId: primary.id,
              bcReference: bcNumber,
              devisReference: primary.devis_number,
            });
            await notifyDossierCreated(dossier.id, companyId);
          } catch (dossierErr) {
            console.warn('[flux] dossier creation:', dossierErr);
          }
        }
        toast.success(`BC ${bcNumber} créé avec succès`);
        setIsBCReviewOpen(false);
        setDevisListToConvert([]);
        await loadAll();
        setActiveSection('bc');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création');
    }
  }, [devisListToConvert, generateNextNumber, loadAll]);

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
    setExistingAttachments(parseAttachmentUrls(d.attachment_urls));
    setPendingAttachmentFiles([]);
    setShowEditDialog(true);
  }, []);

  const handleAddNew = useCallback((mode: 'devis' | 'bc' | 'ba') => {
    setEditingDevis(null);
    setShowEditDialog(false);
    clearFormFields(true);
    setDevisType(defaultDevisType);
    setDocType(mode);
    setDevisNumber(generateNextNumber(defaultDevisType, mode));
    setActiveSection('form');
  }, [clearFormFields, defaultDevisType, generateNextNumber]);

  const accentIsAchat = (lockDevisType ? defaultDevisType : devisType) === 'achat';
  const tabActiveClass = accentIsAchat
    ? 'bg-orange-600 text-white shadow-md'
    : 'bg-emerald-600 text-white shadow-md';
  const tabBarClass = accentIsAchat ? 'bg-orange-500/10' : 'bg-emerald-500/10';

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
          onClick={() => setActiveSection('history')}
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
            onClick={() => setActiveSection('bc')}
            className={sectionTabClass(activeSection === 'bc')}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            BC
            <span className="tabular-nums opacity-80">({bonsCommande.length})</span>
          </button>
        )}
        <button
          type="button"
          title="Assistant import devis (PDF)"
          onClick={() => setActiveSection('helper')}
          className={sectionTabClass(activeSection === 'helper')}
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          Helper
        </button>
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

      {activeSection === 'helper' && (
        <DevisHelper onTabChange={onTabChange} />
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


    </div>
  );
};

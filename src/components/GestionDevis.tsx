import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, History, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Devis, DevisItem, BonCommande } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { computeDevisTotals } from '@/lib/devisPricing';
import { DevisForm } from './devis/DevisForm';
import { DevisHistory } from './devis/DevisHistory';
import { BonCommandeList } from './devis/BonCommandeList';
import { DevisHelper } from './devis/DevisHelper';
import { BCCreationDialog } from './devis/BCCreationDialog';
import { DevisToSupplierBCDialog } from './devis/DevisToSupplierBCDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const parseDevisRow = (d: any, profilesMap: Record<string, string>, sourceDevisMap?: Record<number, string>): Devis => {
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
    source_devis_id: d.source_devis_id ?? null,
    creator_name: d.created_by ? (profilesMap[d.created_by] || null) : null,
    source_devis_number: d.source_devis_id && sourceDevisMap ? (sourceDevisMap[d.source_devis_id] || null) : null,
  };
};

interface GestionDevisProps {
  onTabChange?: (tab: string) => void;
  initialSection?: 'form' | 'history' | 'bc' | 'helper';
  initialDocType?: 'devis' | 'bc' | 'ba';
  initialDevisType?: 'achat' | 'vente';
  lockDevisType?: boolean;
  sectionMode?: 'devis' | 'bc';
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
  const [activeSection, setActiveSection] = useState<'form' | 'history' | 'bc' | 'helper'>(
    (initialSection as any) === 'ba' ? 'form' : initialSection
  );
  const [allDevis, setAllDevis] = useState<Devis[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [isBCReviewOpen, setIsBCReviewOpen] = useState(false);
  const [devisToConvert, setDevisToConvert] = useState<Devis | null>(null);
  const [devisForSupplierBC, setDevisForSupplierBC] = useState<Devis | null>(null);
  const [docType, setDocType] = useState<'devis' | 'bc' | 'ba'>(
    (initialDocType as any) === 'ba' ? 'ba' : initialDocType
  );
  const devisNumberRef = useRef('');

  // Form state
  const defaultDevisType = initialDevisType ?? 'vente';
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
  const [isTtc, setIsTtc] = useState(true);

  // Derived lists
  const savedDevis = useMemo(() => allDevis.filter(d => !d.is_bc && !d.is_ba), [allDevis]);
  const bonsCommande = useMemo(() => allDevis.filter(d => d.is_bc), [allDevis]);
  const bonsAchat = useMemo(() => allDevis.filter(d => d.is_ba), [allDevis]);
  /** Hide "Liste BC" in nav only on locked Mes Devis pages (vente/achat); keep it on dedicated Liste BC routes (sectionMode bc). */
  const hideListBcTab = Boolean(sectionMode === 'devis' && lockDevisType);

  const loadAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!error && data) {
      const creatorIds = [...new Set(data.map(d => d.created_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', creatorIds);
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.user_id] = p.full_name || p.email || 'Inconnu';
          });
        }
      }

      // Build source devis number map for BCs
      const sourceIds = [...new Set(data.filter(d => (d as any).source_devis_id).map(d => (d as any).source_devis_id))] as number[];
      let sourceDevisMap: Record<number, string> = {};
      if (sourceIds.length > 0) {
        data.forEach(d => {
          if (sourceIds.includes(d.id)) {
            sourceDevisMap[d.id] = d.devis_number;
          }
        });
      }

      setAllDevis(data.map(d => parseDevisRow(d, profilesMap, sourceDevisMap)));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Update active section and doc type if props change
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
    if (initialDocType) setDocType(initialDocType);
    if (initialDevisType) setDevisType(initialDevisType);
  }, [initialSection, initialDocType, initialDevisType]);

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
    if (!editingDevis) {
      setDevisNumber(generateNextNumber(devisType, docType));
    }
  }, [allDevis, devisType, docType, editingDevis, generateNextNumber]);

  const clearFormFields = useCallback((clearItems = true) => {
    setDevisDate(new Date().toISOString().split('T')[0]);
    setThirdPartyName('');
    setThirdPartyAddress('');
    setThirdPartyTaxId('');
    setThirdPartyPhone('');
    setNotes('');
    setDocumentStatus('brouillon');
    if (clearItems) setDevisItems([]);
    setIsTtc(true);
  }, []);

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

  const saveDevis = useCallback(async () => {
    if (isSaving) return;
    if (devisItems.length === 0) {
      toast.error('Ajoutez au moins un article');
      return;
    }
    const currentDevisNumber = devisNumberRef.current;
    if (!currentDevisNumber) {
      toast.error('Numéro de devis manquant, veuillez patienter');
      return;
    }
    setIsSaving(true);
    try {
      const totals = computeDevisTotals(devisItems, false);
      const totalAmount = totals.totalTTC;
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('devis').insert({
        type: devisType,
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
        is_bc: docType === 'bc',
        is_ba: false,
        status: docType === 'bc' ? documentStatus : 'brouillon',
      } as any);

      if (error) {
        toast.error('Erreur lors de la sauvegarde');
        console.error(error);
      } else {
        toast.success('Devis sauvegardé');
        await loadAll();
        clearFormFields();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, devisType, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, docType, documentStatus, loadAll, clearFormFields]);

  const updateDevis = useCallback(async () => {
    if (!editingDevis) return;
    const totals = computeDevisTotals(devisItems, false);
    const totalAmount = totals.totalTTC;

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
      is_bc: docType === 'bc',
      is_ba: false,
      status: docType === 'bc' ? documentStatus : editingDevis.status,
    } as any).eq('id', editingDevis.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Devis mis à jour');
      resetForm();
      loadAll();
    }
  }, [editingDevis, docType, devisType, devisNumber, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, documentStatus, loadAll, resetForm]);

  const deleteDevis = useCallback(async (devis: Devis) => {
    const { error } = await supabase.from('devis').delete().eq('id', devis.id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      let msg = 'Devis supprimé';
      if (devis.is_bc) msg = 'Bon de commande supprimé';
      toast.success(msg);
      loadAll();
    }
  }, [loadAll]);

  const convertToBC = useCallback((devis: Devis) => {
    setDevisToConvert(devis);
    setIsBCReviewOpen(true);
  }, []);

  const convertToBCFournisseur = useCallback((devis: Devis) => {
    setDevisForSupplierBC(devis);
  }, []);

  const handleConfirmBC = useCallback(async (modifiedItems: DevisItem[], bcStatus: 'brouillon' | 'envoyé' | 'confirmé') => {
    if (!devisToConvert) return;
    
    try {
      const bcNumber = generateNextNumber(devisToConvert.type, 'bc');
      const { data: { user } } = await supabase.auth.getUser();
      const totals = computeDevisTotals(modifiedItems, false);

      const { error } = await supabase.from('devis').insert({
        devis_number: bcNumber,
        devis_date: new Date().toISOString().split('T')[0],
        source_devis_id: devisToConvert.id,
        type: devisToConvert.type,
        third_party_name: devisToConvert.third_party_name,
        third_party_address: devisToConvert.third_party_address,
        third_party_tax_id: devisToConvert.third_party_tax_id,
        third_party_phone: devisToConvert.third_party_phone,
        items: JSON.parse(JSON.stringify(modifiedItems)),
        total_amount: totals.totalTTC,
        notes: devisToConvert.notes,
        is_ttc: devisToConvert.is_ttc,
        is_bc: true,
        created_by: user?.id,
        status: bcStatus,
      } as any);

      if (error) {
        toast.error('Erreur lors de la création du BC');
        console.error(error);
      } else {
        await supabase
          .from('devis')
          .update({ status: 'accepté' } as any)
          .eq('id', devisToConvert.id);
        toast.success(`BC ${bcNumber} créé avec succès`);
        setIsBCReviewOpen(false);
        setDevisToConvert(null);
        await loadAll();
        setActiveSection('bc');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création');
    }
  }, [devisToConvert, generateNextNumber, loadAll]);

  const startEdit = useCallback((d: Devis) => {
    setEditingDevis(d);
    setDevisType(d.type);
    if (d.is_ba) setDocType('ba');
    else if (d.is_bc) setDocType('bc');
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
    setIsTtc(d.is_ttc);
    setShowEditDialog(true);
  }, []);

  const handleAddNew = useCallback((mode: 'devis' | 'bc' | 'ba') => {
    resetForm();
    setDevisType(defaultDevisType);
    setDocType(mode);
    setActiveSection('form');
  }, [defaultDevisType, resetForm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Section tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit flex-wrap">
        <button
          onClick={() => {
            if (!editingDevis) handleAddNew(sectionMode ?? 'devis');
            else setActiveSection('form');
          }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'form'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="w-4 h-4" />
          {editingDevis
            ? 'Modifier Document'
            : sectionMode === 'bc'
              ? 'CRÉER UN BON DE COMMANDE'
              : sectionMode === 'devis'
                ? 'CRÉER UN DEVIS'
                : 'CRÉER DOCUMENT'}
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'history'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          Liste Devis ({savedDevis.length})
        </button>
        {!hideListBcTab && (
          <button
            onClick={() => setActiveSection('bc')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              activeSection === 'bc'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            Liste BC ({bonsCommande.length})
          </button>
        )}
        <button
          onClick={() => setActiveSection('helper')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'helper'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="w-4 h-4" />
          Devis Helper
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
          onConvertToBCFournisseur={initialDevisType === 'vente' ? convertToBCFournisseur : undefined}
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
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BCCreationDialog
        open={isBCReviewOpen}
        onOpenChange={setIsBCReviewOpen}
        sourceDevis={devisToConvert}
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


    </div>
  );
};

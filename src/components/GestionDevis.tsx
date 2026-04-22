import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, History, Plus, Search, ShoppingCart, TrendingUp } from 'lucide-react';
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
import { UnifiedDocumentList } from './devis/UnifiedDocumentList';
import { SalesPipeline } from './devis/SalesPipeline';
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
    type: d.type as 'entrant' | 'sortant',
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
  initialSection?: 'form' | 'history' | 'bc' | 'helper' | 'achats' | 'pipeline';
  initialDocType?: 'devis' | 'bc' | 'ba';
}

export const GestionDevis = ({ onTabChange, initialSection = 'form', initialDocType = 'devis' }: GestionDevisProps) => {
  const { isAdmin, isModerator, user } = useAuth();
  const canEdit = true;
  const [activeSection, setActiveSection] = useState<'form' | 'history' | 'bc' | 'helper' | 'achats' | 'pipeline'>(
    (initialSection as any) === 'ba' ? 'form' : initialSection
  );
  const [allDevis, setAllDevis] = useState<Devis[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [isBCReviewOpen, setIsBCReviewOpen] = useState(false);
  const [devisToConvert, setDevisToConvert] = useState<Devis | null>(null);
  const [docType, setDocType] = useState<'devis' | 'bc' | 'ba'>(
    (initialDocType as any) === 'ba' ? 'ba' : initialDocType
  );
  const devisNumberRef = useRef('');

  // Form state
  const [devisType, setDevisType] = useState<'entrant' | 'sortant'>('sortant');
  const [devisNumber, setDevisNumber] = useState('');
  const [devisDate, setDevisDate] = useState(new Date().toISOString().split('T')[0]);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyAddress, setThirdPartyAddress] = useState('');
  const [thirdPartyTaxId, setThirdPartyTaxId] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [devisItems, setDevisItems] = useState<DevisItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTtc, setIsTtc] = useState(true);

  // Derived lists
  const savedDevis = useMemo(() => allDevis.filter(d => !d.is_bc && !d.is_ba), [allDevis]);
  const bonsCommande = useMemo(() => allDevis.filter(d => d.is_bc), [allDevis]);
  const bonsAchat = useMemo(() => allDevis.filter(d => d.is_ba), [allDevis]);

  const loadAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .order('created_at', { ascending: false });

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
  }, [initialSection, initialDocType]);

  useEffect(() => { devisNumberRef.current = devisNumber; }, [devisNumber]);

  const generateNextNumber = useCallback((type: 'entrant' | 'sortant', mode: 'devis' | 'bc' | 'ba' = 'devis') => {
    let prefix = 'DE';
    if (mode === 'bc') {
      prefix = type === 'entrant' ? 'BCE' : 'BCS';
    } else if (mode === 'ba') {
      prefix = 'BA';
    } else {
      prefix = type === 'entrant' ? 'DE' : 'DS';
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
    if (clearItems) setDevisItems([]);
    setIsTtc(true);
  }, []);

  const resetForm = useCallback(() => {
    setDevisType('sortant');
    setDocType('devis');
    clearFormFields(true);
    setEditingDevis(null);
    setShowEditDialog(false);
    setDevisNumber(generateNextNumber('sortant', 'devis'));
  }, [clearFormFields, generateNextNumber]);

  const clearInputsOnly = useCallback(() => {
    clearFormFields(false);
    setDevisNumber(generateNextNumber(devisType, docType));
  }, [clearFormFields, generateNextNumber, devisType, docType]);

  const handleTypeChange = useCallback((type: 'entrant' | 'sortant') => {
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
  }, [isSaving, devisType, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, loadAll, clearFormFields]);

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
    } as any).eq('id', editingDevis.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Devis mis à jour');
      resetForm();
      loadAll();
    }
  }, [editingDevis, docType, devisType, devisNumber, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, isTtc, loadAll, resetForm]);

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

  const handleConfirmBC = useCallback(async (modifiedItems: DevisItem[]) => {
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
        status: 'confirmé',
      } as any);

      if (error) {
        toast.error('Erreur lors de la création du BC');
        console.error(error);
      } else {
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
    setDevisItems(d.items);
    setIsTtc(d.is_ttc);
    setShowEditDialog(true);
  }, []);

  const handleAddNew = useCallback((mode: 'devis' | 'bc' | 'ba') => {
    resetForm();
    setDocType(mode);
    setActiveSection('form');
  }, [resetForm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Section tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit flex-wrap">
        <button
          onClick={() => { setActiveSection('form'); if (!editingDevis) resetForm(); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'form'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="w-4 h-4" />
          {editingDevis ? 'Modifier Document' : 'CRÉER DOCUMENT'}
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
        <button
          onClick={() => setActiveSection('achats')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'achats'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          ACHATS (Moteur v2)
        </button>
        <button
          onClick={() => setActiveSection('pipeline')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'pipeline'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Suivi Pipeline
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
          setDevisItems={setDevisItems}
          setIsTtc={setIsTtc}
          onSave={saveDevis}
          onUpdate={updateDevis}
          onCancel={editingDevis ? resetForm : clearInputsOnly}
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
          onAdd={() => handleAddNew('devis')}
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
        />
      )}



      {activeSection === 'helper' && (
        <DevisHelper onTabChange={onTabChange} />
      )}

      {activeSection === 'achats' && (
        <UnifiedDocumentList />
      )}

      {activeSection === 'pipeline' && (
        <SalesPipeline />
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
                setDevisItems={setDevisItems}
                setIsTtc={setIsTtc}
                onSave={saveDevis}
                onUpdate={updateDevis}
                onCancel={resetForm}
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


    </div>
  );
};
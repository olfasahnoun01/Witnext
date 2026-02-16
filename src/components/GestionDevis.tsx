import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, History, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Devis, DevisItem } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { DevisForm } from './devis/DevisForm';
import { DevisHistory } from './devis/DevisHistory';

export const GestionDevis = () => {
  const { isAdmin, isModerator } = useAuth();
  const canEdit = isAdmin || isModerator;
  const [activeSection, setActiveSection] = useState<'form' | 'history'>('form');
  const [savedDevis, setSavedDevis] = useState<Devis[]>([]);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);

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

  const loadDevis = useCallback(async () => {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedDevis(data.map(d => {
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
          status: d.status as 'brouillon' | 'envoyé' | 'accepté' | 'refusé',
          items: parsedItems,
          total_amount: Number(d.total_amount) || 0,
        };
      }));
    }
  }, []);

  useEffect(() => { loadDevis(); }, [loadDevis]);

  const generateNextNumber = useCallback((type: 'entrant' | 'sortant') => {
    const prefix = type === 'entrant' ? 'DE' : 'DS';
    const docsOfType = savedDevis.filter(d => d.type === type);
    let maxNum = 0;
    docsOfType.forEach(d => {
      const match = d.devis_number.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });
    setDevisNumber(`${prefix}-${(maxNum + 1).toString().padStart(2, '0')}`);
  }, [savedDevis]);

  useEffect(() => {
    if (!editingDevis) generateNextNumber(devisType);
  }, [devisType, editingDevis, generateNextNumber]);

  const resetForm = useCallback(() => {
    setDevisType('sortant');
    setDevisNumber('');
    setDevisDate(new Date().toISOString().split('T')[0]);
    setThirdPartyName('');
    setThirdPartyAddress('');
    setThirdPartyTaxId('');
    setThirdPartyPhone('');
    setNotes('');
    setDevisItems([]);
    setEditingDevis(null);
  }, []);

  const saveDevis = useCallback(async () => {
    if (isSaving) return;
    if (devisItems.length === 0) {
      toast.error('Ajoutez au moins un article');
      return;
    }
    setIsSaving(true);
    try {
      const totalAmount = devisItems.reduce((s, i) => s + i.prix_ttc * i.quantity, 0);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('devis').insert({
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
        created_by: user?.id,
      } as any);

      if (error) {
        toast.error('Erreur lors de la sauvegarde');
        console.error(error);
      } else {
        toast.success('Devis sauvegardé');
        const savedType = devisType;
        resetForm();
        await loadDevis();
        generateNextNumber(savedType);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, devisType, devisNumber, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, loadDevis, resetForm, generateNextNumber]);

  const updateDevis = useCallback(async () => {
    if (!editingDevis) return;
    const totalAmount = devisItems.reduce((s, i) => s + i.prix_ttc * i.quantity, 0);

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
    } as any).eq('id', editingDevis.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Devis mis à jour');
      resetForm();
      loadDevis();
    }
  }, [editingDevis, devisType, devisNumber, devisDate, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone, notes, devisItems, loadDevis, resetForm]);

  const deleteDevis = useCallback(async (devis: Devis) => {
    const { error } = await supabase.from('devis').delete().eq('id', devis.id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Devis supprimé');
      loadDevis();
    }
  }, [loadDevis]);

  const startEdit = useCallback((d: Devis) => {
    setEditingDevis(d);
    setDevisType(d.type);
    setDevisNumber(d.devis_number);
    setDevisDate(d.devis_date);
    setThirdPartyName(d.third_party_name || '');
    setThirdPartyAddress(d.third_party_address || '');
    setThirdPartyTaxId(d.third_party_tax_id || '');
    setThirdPartyPhone(d.third_party_phone || '');
    setNotes(d.notes || '');
    setDevisItems(d.items);
    setActiveSection('form');
  }, []);

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
          {editingDevis ? 'Modifier Devis' : 'Nouveau Devis'}
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
          Historique ({savedDevis.length})
        </button>
      </div>

      {activeSection === 'form' && (
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
          setDevisType={setDevisType}
          setDevisNumber={setDevisNumber}
          setDevisDate={setDevisDate}
          setThirdPartyName={setThirdPartyName}
          setThirdPartyAddress={setThirdPartyAddress}
          setThirdPartyTaxId={setThirdPartyTaxId}
          setThirdPartyPhone={setThirdPartyPhone}
          setNotes={setNotes}
          setDevisItems={setDevisItems}
          onSave={saveDevis}
          onUpdate={updateDevis}
          onCancel={resetForm}
        />
      )}

      {activeSection === 'history' && (
        <DevisHistory
          savedDevis={savedDevis}
          canEdit={canEdit}
          onEdit={startEdit}
          onDelete={deleteDevis}
        />
      )}
    </div>
  );
};

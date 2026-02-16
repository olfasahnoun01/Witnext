import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit, Building2, Users, Save, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Devis, DevisItem } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SPECIALITES } from '@/constants/fournisseurs';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface Fournisseur {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
}

interface Client {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
}

interface DevisFormProps {
  devisType: 'entrant' | 'sortant';
  devisNumber: string;
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  devisItems: DevisItem[];
  editingDevis: Devis | null;
  isSaving: boolean;
  setDevisType: (t: 'entrant' | 'sortant') => void;
  setDevisNumber: (v: string) => void;
  setDevisDate: (v: string) => void;
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
  setNotes: (v: string) => void;
  setDevisItems: React.Dispatch<React.SetStateAction<DevisItem[]>>;
  onSave: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

export const DevisForm = memo(({
  devisType, devisNumber, devisDate,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone,
  notes, devisItems, editingDevis, isSaving,
  setDevisType, setDevisNumber, setDevisDate,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone,
  setNotes, setDevisItems,
  onSave, onUpdate, onCancel,
}: DevisFormProps) => {
  const isEntrant = devisType === 'entrant';

  // Third parties
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState('');

  // New fournisseur dialog
  const [showNewFournisseur, setShowNewFournisseur] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState('');
  const [newFournisseurMatricule, setNewFournisseurMatricule] = useState('');
  const [newFournisseurPhone, setNewFournisseurPhone] = useState('');
  const [newFournisseurSpecialite, setNewFournisseurSpecialite] = useState('');
  const [newFournisseurGovernorate, setNewFournisseurGovernorate] = useState('');
  const [newFournisseurCity, setNewFournisseurCity] = useState('');

  // Item form
  const [itemDesignation, setItemDesignation] = useState('');
  const [itemFournisseur, setItemFournisseur] = useState('');
  const [itemPrixTtc, setItemPrixTtc] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');

  useEffect(() => {
    const load = async () => {
      const [fRes, cRes] = await Promise.all([
        supabase.from('fournisseurs').select('id, nom, matricule_fiscale, location, phone').order('nom'),
        supabase.from('clients').select('id, nom, matricule_fiscale, location, phone').order('nom'),
      ]);
      if (fRes.data) setFournisseurs(fRes.data);
      if (cRes.data) setClients(cRes.data);
    };
    load();
  }, []);

  useEffect(() => { setSelectedThirdPartyId(''); }, [devisType]);

  const handleThirdPartySelect = useCallback((id: string) => {
    setSelectedThirdPartyId(id);
    if (id === 'manual') {
      setThirdPartyName(''); setThirdPartyAddress(''); setThirdPartyTaxId(''); setThirdPartyPhone('');
      return;
    }
    const list = isEntrant ? fournisseurs : clients;
    const item = list.find(x => x.id.toString() === id);
    if (item) {
      setThirdPartyName(item.nom);
      setThirdPartyAddress(item.location || '');
      setThirdPartyTaxId(item.matricule_fiscale || '');
      setThirdPartyPhone(item.phone || '');
    }
  }, [isEntrant, fournisseurs, clients, setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone]);

  const newFournisseurCities = useMemo(() => {
    return newFournisseurGovernorate
      ? TUNISIA_LOCATIONS.find(r => r.governorate === newFournisseurGovernorate)?.cities || []
      : [];
  }, [newFournisseurGovernorate]);

  const resetNewFournisseurForm = useCallback(() => {
    setNewFournisseurName('');
    setNewFournisseurMatricule('');
    setNewFournisseurPhone('');
    setNewFournisseurSpecialite('');
    setNewFournisseurGovernorate('');
    setNewFournisseurCity('');
  }, []);

  const createFournisseur = useCallback(async () => {
    if (!newFournisseurName.trim()) { toast.error('Nom requis'); return; }
    if (!newFournisseurSpecialite) { toast.error('Spécialité requise'); return; }

    const locationValue = newFournisseurCity && newFournisseurGovernorate
      ? `${newFournisseurCity}, ${newFournisseurGovernorate}`
      : null;

    const { data, error } = await supabase.from('fournisseurs').insert({
      nom: newFournisseurName.trim(),
      matricule_fiscale: newFournisseurMatricule.trim() || null,
      specialite: newFournisseurSpecialite,
      phone: newFournisseurPhone.trim() || null,
      location: locationValue,
    }).select().single();
    if (error) {
      toast.error('Erreur création fournisseur');
    } else if (data) {
      toast.success('Fournisseur créé');
      setFournisseurs(prev => [...prev, data as Fournisseur].sort((a, b) => a.nom.localeCompare(b.nom)));
      if (isEntrant) {
        setThirdPartyName(data.nom);
        setThirdPartyPhone((data as any).phone || '');
        setThirdPartyAddress((data as any).location || '');
        setThirdPartyTaxId((data as any).matricule_fiscale || '');
        setSelectedThirdPartyId(data.id.toString());
      }
      setShowNewFournisseur(false);
      resetNewFournisseurForm();
    }
  }, [newFournisseurName, newFournisseurMatricule, newFournisseurPhone, newFournisseurSpecialite, newFournisseurGovernorate, newFournisseurCity, isEntrant, setThirdPartyName, setThirdPartyPhone, setThirdPartyAddress, setThirdPartyTaxId, resetNewFournisseurForm]);

  const addItem = useCallback(() => {
    if (!itemDesignation.trim()) { toast.error('Nom d\'article requis'); return; }
    setDevisItems(prev => [...prev, {
      designation: itemDesignation.trim(),
      fournisseur: itemFournisseur.trim(),
      prix_ttc: itemPrixTtc,
      quantity: itemQuantity,
      description: itemDescription.trim() || undefined,
    }]);
    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemQuantity(1);
    setItemDescription('');
  }, [itemDesignation, itemFournisseur, itemPrixTtc, itemQuantity, itemDescription, setDevisItems]);

  const removeItem = useCallback((idx: number) => {
    setDevisItems(prev => prev.filter((_, i) => i !== idx));
  }, [setDevisItems]);

  const totalAmount = devisItems.reduce((s, i) => s + i.prix_ttc * i.quantity, 0);
  const thirdPartyList = isEntrant ? fournisseurs : clients;
  const ThirdPartyIcon = isEntrant ? Building2 : Users;
  const thirdPartyLabel = isEntrant ? 'Fournisseur (expéditeur)' : 'Client (destinataire)';

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {editingDevis ? 'Modifier Devis' : 'Nouveau Devis'}
            </h3>
            {editingDevis && (
              <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="form-label">Type de Devis</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDevisType('entrant')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  devisType === 'entrant'
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                📥 Devis Entrant
              </button>
              <button
                onClick={() => setDevisType('sortant')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  devisType === 'sortant'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                📤 Devis Sortant
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isEntrant
                ? '⬇️ Un fournisseur nous envoie un devis (nous sommes le récepteur)'
                : '⬆️ Nous envoyons un devis à un client'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">N° Devis</label>
              <input type="text" value={devisNumber} onChange={e => setDevisNumber(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" value={devisDate} onChange={e => setDevisDate(e.target.value)} className="form-input" />
            </div>
          </div>

          {/* Third Party */}
          <div className={`p-4 rounded-xl ${isEntrant ? 'bg-success/5 border border-success/20' : 'bg-primary/5 border border-primary/20'}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-medium flex items-center gap-2 ${isEntrant ? 'text-success' : 'text-primary'}`}>
                <ThirdPartyIcon className="w-4 h-4" />
                {thirdPartyLabel}
              </h4>
              {isEntrant && (
                <Button variant="ghost" size="sm" onClick={() => setShowNewFournisseur(true)} className="text-xs">
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Nouveau
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <Select value={selectedThirdPartyId} onValueChange={handleThirdPartySelect}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder={`Sélectionner...`} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="manual">
                    <span className="flex items-center gap-2"><Edit className="w-4 h-4" /> Saisie manuelle</span>
                  </SelectItem>
                  {thirdPartyList.map(item => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      <span className="font-medium">{item.nom}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="text" value={thirdPartyName} onChange={e => setThirdPartyName(e.target.value)} className="form-input" placeholder="Raison sociale" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={thirdPartyPhone} onChange={e => setThirdPartyPhone(e.target.value)} className="form-input" placeholder="Téléphone" />
                <input type="text" value={thirdPartyTaxId} onChange={e => setThirdPartyTaxId(e.target.value)} className="form-input" placeholder="Matricule Fiscale" />
              </div>
              <input type="text" value={thirdPartyAddress} onChange={e => setThirdPartyAddress(e.target.value)} className="form-input" placeholder="Adresse" />
            </div>
          </div>

          {/* Add Item - free-form */}
          <div>
            <h4 className="font-medium text-foreground mb-3">Ajouter un Article</h4>
            <p className="text-xs text-muted-foreground mb-3">
              ⚠️ Les devis n'affectent pas le stock
            </p>
            <div className="space-y-3">
              <input type="text" value={itemDesignation} onChange={e => setItemDesignation(e.target.value)} className="form-input" placeholder="Nom de l'article *" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={itemFournisseur} onChange={e => setItemFournisseur(e.target.value)} className="form-input" placeholder="Fournisseur" />
                <input type="text" value={itemDescription} onChange={e => setItemDescription(e.target.value)} className="form-input" placeholder="Description (opt.)" />
              </div>
              <div className="flex gap-3 flex-wrap">
                <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input w-24" placeholder="Qté" />
                <input type="number" min="0" step="0.001" value={itemPrixTtc || ''} onChange={e => setItemPrixTtc(parseFloat(e.target.value) || 0)} className="form-input w-36" placeholder="Prix TTC (TND)" />
                <Button onClick={addItem} disabled={!itemDesignation.trim()}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter
                </Button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="form-input min-h-[60px] resize-y" placeholder="Notes ou commentaires..." />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {editingDevis ? (
              <Button onClick={onUpdate} className="flex-1">
                <Edit className="w-4 h-4 mr-2" /> Mettre à jour
              </Button>
            ) : (
              <Button onClick={onSave} className="flex-1" disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            )}
          </div>
        </div>

        {/* Items Preview */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Articles du Devis</h3>
            <span className="text-sm font-medium text-primary">
              Total: {totalAmount.toFixed(3)} TND
            </span>
          </div>

          {devisItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Aucun article ajouté.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devisItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.designation}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.fournisseur && `${item.fournisseur} • `}
                      Qté: {item.quantity} • {item.prix_ttc.toFixed(3)} TND
                      {item.quantity > 1 && ` = ${(item.prix_ttc * item.quantity).toFixed(3)} TND`}
                    </p>
                    {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Fournisseur Dialog */}
      <Dialog open={showNewFournisseur} onOpenChange={(open) => {
        setShowNewFournisseur(open);
        if (!open) resetNewFournisseurForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom (Société) *</Label>
              <Input value={newFournisseurName} onChange={e => setNewFournisseurName(e.target.value)} placeholder="Nom du fournisseur" />
            </div>
            <div className="space-y-2">
              <Label>Matricule Fiscale</Label>
              <Input value={newFournisseurMatricule} onChange={e => setNewFournisseurMatricule(e.target.value)} placeholder="Ex: 1234567/A/B/C/000" />
            </div>
            <div className="space-y-2">
              <Label>Spécialité *</Label>
              <Select value={newFournisseurSpecialite} onValueChange={setNewFournisseurSpecialite}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une spécialité" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALITES.map(spec => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={newFournisseurPhone} onChange={e => setNewFournisseurPhone(e.target.value)} placeholder="Ex: +216 XX XXX XXX" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Gouvernorat</Label>
                <Select value={newFournisseurGovernorate} onValueChange={val => { setNewFournisseurGovernorate(val); setNewFournisseurCity(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Région" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {TUNISIA_LOCATIONS.map(r => (
                      <SelectItem key={r.governorate} value={r.governorate}>{r.governorate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Select value={newFournisseurCity} onValueChange={setNewFournisseurCity} disabled={!newFournisseurGovernorate}>
                  <SelectTrigger>
                    <SelectValue placeholder={newFournisseurGovernorate ? "Ville" : "Choisir région"} />
                  </SelectTrigger>
                  <SelectContent>
                    {newFournisseurCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewFournisseur(false); resetNewFournisseurForm(); }}>Annuler</Button>
            <Button onClick={createFournisseur}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

DevisForm.displayName = 'DevisForm';

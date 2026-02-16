import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { ProductGroupFournisseur } from '@/types';
import { Plus, Trash2, Edit, Building2, Users, Save, X, UserPlus, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Devis, DevisItem, Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiFournisseurInput } from '@/components/inventory/MultiFournisseurInput';
import { SPECIALITES } from '@/constants/fournisseurs';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, ChevronsUpDown, Check } from 'lucide-react';
import { useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = ['Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Non catégorisé'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];
const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Marron', 'Beige'];

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
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  // New fournisseur dialog
  const [showNewFournisseur, setShowNewFournisseur] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState('');
  const [newFournisseurMatricule, setNewFournisseurMatricule] = useState('');
  const [newFournisseurPhone, setNewFournisseurPhone] = useState('');
  const [newFournisseurSpecialite, setNewFournisseurSpecialite] = useState('');
  const [newFournisseurGovernorate, setNewFournisseurGovernorate] = useState('');
  const [newFournisseurCity, setNewFournisseurCity] = useState('');

  // Article mode: 'search' | 'manual'
  const [articleMode, setArticleMode] = useState<'search' | 'manual'>('search');

  // Search existing products
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Item form (manual or from selected product)
  const [itemDesignation, setItemDesignation] = useState('');
  const [itemFournisseur, setItemFournisseur] = useState('');
  const [itemPrixTtc, setItemPrixTtc] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');

  // New article dialog (full product creation popup)
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState({
    name: '', sku: '', category: '', size: '', quantity: 0, price: 0, remise: 0, min_stock: 5, image: null as string | null, color: '',
  });
  const [newArticleFournisseurs, setNewArticleFournisseurs] = useState<ProductGroupFournisseur[]>([]);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [fRes, cRes, pCatRes, pgCatRes] = await Promise.all([
        supabase.from('fournisseurs').select('id, nom, matricule_fiscale, location, phone').order('nom'),
        supabase.from('clients').select('id, nom, matricule_fiscale, location, phone').order('nom'),
        supabase.from('products').select('category'),
        supabase.from('product_groups').select('category'),
      ]);
      if (fRes.data) setFournisseurs(fRes.data);
      if (cRes.data) setClients(cRes.data);
      const allCats = new Set<string>(DEFAULT_CATEGORIES);
      (pCatRes.data || []).forEach(p => allCats.add(p.category));
      (pgCatRes.data || []).forEach(p => allCats.add(p.category));
      setDbCategories([...allCats].sort());
    };
    load();
  }, []);

  // Search products
  useEffect(() => {
    if (!debouncedSearch.trim()) { setSearchResults([]); return; }
    const search = async () => {
      setIsSearching(true);
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`)
        .limit(10);
      setSearchResults((data || []).map(p => ({
        ...p,
        fournisseur: p.fournisseur || '',
        size: p.size || '',
        remise: p.remise || 0,
        prix_ttc: p.prix_ttc || p.price * (1 - (p.remise || 0) / 100),
        color: p.color || null,
      })));
      setIsSearching(false);
    };
    search();
  }, [debouncedSearch]);

  const selectExistingProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setItemDesignation(product.name);
    setItemFournisseur(product.fournisseur || '');
    setItemPrixTtc(product.prix_ttc || product.price * (1 - (product.remise || 0) / 100));
    setItemQuantity(1);
    setItemDescription(`${product.sku}${product.size ? ` - Taille: ${product.size}` : ''}${product.color ? ` - ${product.color}` : ''}`);
    setProductSearch('');
    setSearchResults([]);
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
    setSelectedProduct(null);
  }, [itemDesignation, itemFournisseur, itemPrixTtc, itemQuantity, itemDescription, setDevisItems]);

  const removeItem = useCallback((idx: number) => {
    setDevisItems(prev => prev.filter((_, i) => i !== idx));
  }, [setDevisItems]);

  // New article creation
  const resetNewArticleForm = useCallback(() => {
    setNewArticle({ name: '', sku: '', category: '', size: '', quantity: 0, price: 0, remise: 0, min_stock: 5, image: null, color: '' });
    setNewArticleFournisseurs([]);
  }, []);

  const handleArticleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewArticle(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const createNewArticle = useCallback(async () => {
    if (!newArticle.name.trim()) { toast.error('Nom requis'); return; }
    if (!newArticle.sku.trim()) { toast.error('Code article requis'); return; }
    setIsCreatingArticle(true);
    try {
      const prixTtc = newArticle.price * (1 - newArticle.remise / 100);
      const primaryFournisseur = newArticleFournisseurs.length > 0 ? newArticleFournisseurs[0].fournisseur_name : null;
      
      // Create product group first
      const { data: pgData, error: pgError } = await supabase.from('product_groups').insert({
        name: newArticle.name.trim(),
        base_sku: newArticle.sku.trim(),
        category: newArticle.category || 'Non catégorisé',
        fournisseur: primaryFournisseur,
        min_stock: newArticle.min_stock,
        image: newArticle.image,
      }).select().single();

      if (pgError) { toast.error('Erreur création groupe'); return; }

      // Save multi-fournisseurs
      if (newArticleFournisseurs.length > 0 && pgData) {
        await supabase.from('product_group_fournisseurs').insert(
          newArticleFournisseurs.filter(f => f.fournisseur_name.trim()).map(f => ({
            product_group_id: pgData.id,
            fournisseur_name: f.fournisseur_name.trim(),
            prix_ttc: f.prix_ttc,
          }))
        );
      }

      const { data, error } = await supabase.from('products').insert({
        name: newArticle.name.trim(),
        sku: newArticle.sku.trim(),
        category: newArticle.category || 'Non catégorisé',
        fournisseur: primaryFournisseur,
        product_group_id: pgData?.id || null,
        size: newArticle.size.trim() || null,
        quantity: newArticle.quantity,
        price: newArticle.price,
        remise: newArticle.remise,
        prix_ttc: prixTtc,
        min_stock: newArticle.min_stock,
        image: newArticle.image,
        color: newArticle.color.trim() || null,
      }).select().single();

      if (error) {
        toast.error('Erreur création article');
      } else if (data) {
        toast.success('Article créé avec succès');
        // Auto-fill the item fields
        setItemDesignation(data.name);
        setItemFournisseur(primaryFournisseur || '');
        setItemPrixTtc(prixTtc);
        setItemQuantity(1);
        setItemDescription(`${data.sku}${data.size ? ` - Taille: ${data.size}` : ''}${data.color ? ` - ${data.color}` : ''}`);
        setShowNewArticle(false);
        resetNewArticleForm();
      }
    } finally {
      setIsCreatingArticle(false);
    }
  }, [newArticle, resetNewArticleForm]);

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

          {/* Add Item */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">Ajouter un Article</h4>
              <Button variant="outline" size="sm" onClick={() => setShowNewArticle(true)} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Créer Article
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              ⚠️ Les devis n'affectent pas le stock
            </p>

            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => { setArticleMode('search'); setSelectedProduct(null); setItemDesignation(''); setItemFournisseur(''); setItemPrixTtc(0); setItemDescription(''); }}
                className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  articleMode === 'search' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Sélectionner existant
              </button>
              <button
                onClick={() => { setArticleMode('manual'); setSelectedProduct(null); setItemDesignation(''); setItemFournisseur(''); setItemPrixTtc(0); setItemDescription(''); }}
                className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  articleMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                <Edit className="w-3.5 h-3.5" /> Saisie libre
              </button>
            </div>

            <div className="space-y-3">
              {articleMode === 'search' ? (
                <>
                  {/* Search existing products */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="form-input pl-9"
                      placeholder="Rechercher par nom ou code article..."
                    />
                  </div>
                  {/* Search results dropdown */}
                  {searchResults.length > 0 && (
                    <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-popover">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectExistingProduct(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            {p.image ? (
                              <img src={p.image} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.sku} • {p.category}{p.size ? ` • ${p.size}` : ''}{p.color ? ` • ${p.color}` : ''} • {p.prix_ttc?.toFixed(3) || p.price.toFixed(3)} TND
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {isSearching && <p className="text-xs text-muted-foreground">Recherche...</p>}

                  {/* Selected product info or fill fields */}
                  {selectedProduct && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm font-medium text-foreground">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedProduct.sku} — {selectedProduct.prix_ttc?.toFixed(3)} TND</p>
                    </div>
                  )}

                  {/* Quantity & Price (editable even after selection) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantité</label>
                      <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prix TTC (TND)</label>
                      <input type="number" min="0" step="0.001" value={itemPrixTtc || ''} onChange={e => setItemPrixTtc(parseFloat(e.target.value) || 0)} className="form-input" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Manual entry */}
                  <input type="text" value={itemDesignation} onChange={e => setItemDesignation(e.target.value)} className="form-input" placeholder="Nom de l'article *" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" value={itemFournisseur} onChange={e => setItemFournisseur(e.target.value)} className="form-input" placeholder="Fournisseur" />
                    <input type="text" value={itemDescription} onChange={e => setItemDescription(e.target.value)} className="form-input" placeholder="Description (opt.)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantité</label>
                      <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prix TTC (TND)</label>
                      <input type="number" min="0" step="0.001" value={itemPrixTtc || ''} onChange={e => setItemPrixTtc(parseFloat(e.target.value) || 0)} className="form-input" />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={addItem} disabled={!itemDesignation.trim()} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Ajouter au devis
              </Button>
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

      {/* New Article Dialog */}
      <Dialog open={showNewArticle} onOpenChange={(open) => {
        setShowNewArticle(open);
        if (!open) resetNewArticleForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un Nouvel Article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image Upload */}
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {newArticle.image ? (
                  <img src={newArticle.image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleArticleImageUpload} />
              <div>
                <p className="text-sm font-medium text-foreground">Image du produit</p>
                <p className="text-xs text-muted-foreground">Cliquez pour télécharger</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du produit *</Label>
                <Input value={newArticle.name} onChange={e => setNewArticle(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Pantalon de Travail Pro" />
              </div>
              <div className="space-y-2">
                <Label>Code Article *</Label>
                <Input value={newArticle.sku} onChange={e => setNewArticle(p => ({ ...p, sku: e.target.value }))} placeholder="Ex: PAN-001" />
              </div>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={newArticle.category} onValueChange={val => setNewArticle(p => ({ ...p, category: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {dbCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taille</Label>
                <Input list="devis-sizes" value={newArticle.size} onChange={e => setNewArticle(p => ({ ...p, size: e.target.value }))} placeholder="Optionnel" />
                <datalist id="devis-sizes">
                  {SIZES.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="col-span-2 space-y-2">
                <MultiFournisseurInput value={newArticleFournisseurs} onChange={setNewArticleFournisseurs} />
              </div>
              <div className="space-y-2">
                <Label>Prix (TND)</Label>
                <Input type="number" step="0.001" min="0" value={newArticle.price || ''} onChange={e => setNewArticle(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} placeholder="0.000" />
              </div>
              <div className="space-y-2">
                <Label>Remise (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" value={newArticle.remise || ''} onChange={e => setNewArticle(p => ({ ...p, remise: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Prix TTC (calculé)</Label>
                <div className="h-10 px-3 rounded-lg bg-muted/50 border border-border text-primary font-medium flex items-center text-sm">
                  {(newArticle.price * (1 - newArticle.remise / 100)).toFixed(3)} TND
                </div>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <Input list="devis-colors" value={newArticle.color} onChange={e => setNewArticle(p => ({ ...p, color: e.target.value }))} placeholder="Optionnel" />
                <datalist id="devis-colors">
                  {COLORS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Quantité *</Label>
                <Input type="number" min="0" value={newArticle.quantity} onChange={e => setNewArticle(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Stock Minimum *</Label>
                <Input type="number" min="0" value={newArticle.min_stock} onChange={e => setNewArticle(p => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewArticle(false); resetNewArticleForm(); }}>Annuler</Button>
            <Button onClick={createNewArticle} disabled={isCreatingArticle}>
              {isCreatingArticle ? 'Création...' : 'Créer et Sélectionner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

DevisForm.displayName = 'DevisForm';

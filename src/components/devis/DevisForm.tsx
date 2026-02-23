import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { ProductGroupFournisseur } from '@/types';
import { Plus, Trash2, Edit, Building2, Users, Save, X, UserPlus, Search, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Devis, DevisItem, Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiFournisseurInput } from '@/components/inventory/MultiFournisseurInput';
import { createVariant } from '@/services/productGroupService';
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
  isTtc: boolean;
  setDevisType: (t: 'entrant' | 'sortant') => void;
  setDevisNumber: (v: string) => void;
  setDevisDate: (v: string) => void;
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
  setNotes: (v: string) => void;
  setDevisItems: React.Dispatch<React.SetStateAction<DevisItem[]>>;
  setIsTtc: (v: boolean) => void;
  onSave: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

export const DevisForm = memo(({
  devisType, devisNumber, devisDate,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone,
  notes, devisItems, editingDevis, isSaving, isTtc,
  setDevisType, setDevisNumber, setDevisDate,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone,
  setNotes, setDevisItems, setIsTtc,
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
  const [itemRemise, setItemRemise] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrixAchat, setItemPrixAchat] = useState<number>(0);

  // New article dialog (full product creation popup)
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState({
    name: '', sku: '', category: '', size: '', quantity: 0, min_stock: 5, image: null as string | null, color: '',
  });
  const [newArticleFournisseurs, setNewArticleFournisseurs] = useState<ProductGroupFournisseur[]>([]);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add variant to existing product group
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [productGroups, setProductGroups] = useState<{id: number; name: string; base_sku: string | null; category: string}[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantColor, setVariantColor] = useState('');
  const [variantQuantity, setVariantQuantity] = useState(0);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);

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
    const priceTtc = product.prix_ttc || product.price * (1 - (product.remise || 0) / 100);
    // For entrant: always show HT (divide TTC by 1.19); for sortant: depends on isTtc toggle
    setItemPrixTtc(isEntrant ? priceTtc / 1.19 : (isTtc ? priceTtc : priceTtc / 1.19));
    setItemRemise(product.remise || 0);
    setItemQuantity(1);
    setItemDescription(`${product.sku}${product.size ? ` - Taille: ${product.size}` : ''}${product.color ? ` - ${product.color}` : ''}`);
    // Prix d'achat = price from product (cost price), adjusted for TTC/HT mode
    const basePrixAchat = product.price || 0;
    setItemPrixAchat(isTtc ? basePrixAchat * 1.19 : basePrixAchat);
    setProductSearch('');
    setSearchResults([]);
  }, [isTtc]);

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
    // Store prix_ttc as the unit price BEFORE remise; remise is applied separately in totals
    const finalPrixTtc = isEntrant ? itemPrixTtc * 1.19 : itemPrixTtc;
    setDevisItems(prev => [...prev, {
      designation: itemDesignation.trim(),
      fournisseur: itemFournisseur.trim(),
      prix_ttc: finalPrixTtc,
      remise: itemRemise,
      quantity: itemQuantity,
      description: itemDescription.trim() || undefined,
      ...(devisType === 'sortant' && itemPrixAchat > 0 ? { prix_achat: itemPrixAchat } : {}),
    }]);
    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemRemise(0);
    setItemQuantity(1);
    setItemDescription('');
    setItemPrixAchat(0);
    setSelectedProduct(null);
  }, [itemDesignation, itemFournisseur, itemPrixTtc, itemRemise, itemQuantity, itemDescription, itemPrixAchat, devisType, isEntrant, setDevisItems]);

  const removeItem = useCallback((idx: number) => {
    setDevisItems(prev => prev.filter((_, i) => i !== idx));
  }, [setDevisItems]);

  // New article creation
  const resetNewArticleForm = useCallback(() => {
    setNewArticle({ name: '', sku: '', category: '', size: '', quantity: 0, min_stock: 5, image: null, color: '' });
    setNewArticleFournisseurs([]);
  }, []);

  const handleArticleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage } = await import('@/lib/imageCompression');
        const compressed = await compressImage(file);
        setNewArticle(prev => ({ ...prev, image: compressed }));
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            setNewArticle(prev => ({ ...prev, image: canvas.toDataURL('image/webp', 0.7) }));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const createNewArticle = useCallback(async () => {
    if (!newArticle.name.trim()) { toast.error('Nom requis'); return; }
    if (!newArticle.sku.trim()) { toast.error('Code article requis'); return; }
    setIsCreatingArticle(true);
    try {
      // Auto-create any new fournisseurs that don't exist in the database
      const { data: existingFourns } = await supabase.from('fournisseurs').select('nom');
      const existingNames = new Set((existingFourns || []).map(f => f.nom.toLowerCase()));
      
      const newFournisseurEntries = newArticleFournisseurs
        .filter(f => f.fournisseur_name.trim() && !existingNames.has(f.fournisseur_name.trim().toLowerCase()));
      
      if (newFournisseurEntries.length > 0) {
        await supabase.from('fournisseurs').insert(
          newFournisseurEntries.map(f => ({
            nom: f.fournisseur_name.trim(),
            specialite: newArticle.category || 'Non catégorisé',
            phone: f.phone?.trim() || null,
          }))
        );
      }

      const primaryFournisseur = newArticleFournisseurs.length > 0 ? newArticleFournisseurs[0] : null;
      const prixTtc = primaryFournisseur ? primaryFournisseur.prix_ttc : 0;
      
      // Create product group first
      const { data: pgData, error: pgError } = await supabase.from('product_groups').insert({
        name: newArticle.name.trim(),
        base_sku: newArticle.sku.trim(),
        category: newArticle.category || 'Non catégorisé',
        fournisseur: primaryFournisseur?.fournisseur_name || null,
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
            fiche_technique_url: f.fiche_technique_url || null,
          }))
        );
      }

      // Create one product variant per fournisseur
      const baseSku = newArticle.sku.trim();
      let finalBaseSku = baseSku;
      if (newArticle.size.trim()) finalBaseSku += `-${newArticle.size.trim()}`;
      if (newArticle.color.trim()) finalBaseSku += `-${newArticle.color.trim()}`;

      const productsToInsert = newArticleFournisseurs.length > 0
        ? newArticleFournisseurs.map(f => ({
            name: newArticle.name.trim(),
            sku: finalBaseSku,
            category: newArticle.category || 'Non catégorisé',
            fournisseur: f.fournisseur_name || null,
            product_group_id: pgData?.id || null,
            size: newArticle.size.trim() || null,
            quantity: 0,
            price: f.prix || 0,
            remise: f.remise || 0,
            min_stock: newArticle.min_stock,
            image: newArticle.image,
            color: newArticle.color.trim() || null,
          }))
        : [{
            name: newArticle.name.trim(),
            sku: finalBaseSku,
            category: newArticle.category || 'Non catégorisé',
            fournisseur: null,
            product_group_id: pgData?.id || null,
            size: newArticle.size.trim() || null,
            quantity: 0,
            price: 0,
            remise: 0,
            min_stock: newArticle.min_stock,
            image: newArticle.image,
            color: newArticle.color.trim() || null,
          }];

      const { data, error } = await supabase.from('products').insert(productsToInsert).select();

      if (error) {
        console.error('Product insert error:', error);
        toast.error(`Erreur création article: ${error.message}`);
      } else if (data && data.length > 0) {
        toast.success('Article créé avec succès');
        const first = data[0];
        const description = `${first.sku}${first.size ? ` - Taille: ${first.size}` : ''}${first.color ? ` - ${first.color}` : ''}`;
        
        if (data.length > 1) {
          // Multiple products created (one per fournisseur) — add all as devis lines
          const newItems = data.map(d => ({
            designation: d.name,
            fournisseur: d.fournisseur || '',
            prix_ttc: d.prix_ttc ?? (d.price * (1 - (d.remise || 0) / 100)),
            remise: d.remise || 0,
            quantity: 1,
            description: `${d.sku}${d.size ? ` - Taille: ${d.size}` : ''}${d.color ? ` - ${d.color}` : ''}`.trim() || undefined,
            ...(devisType === 'sortant' ? { prix_achat: d.price || 0 } : {}),
          }));
          setDevisItems(prev => [...prev, ...newItems]);
          setItemDesignation('');
          setItemFournisseur('');
          setItemPrixTtc(0);
          setItemQuantity(1);
          setItemDescription('');
          setSelectedProduct(null);
        } else {
          // Single product: fill the form fields as before
          setItemDesignation(first.name);
          setItemFournisseur(first.fournisseur || '');
          setItemPrixTtc(first.prix_ttc ?? (first.price * (1 - (first.remise || 0) / 100)));
          setItemRemise(first.remise || 0);
          setItemQuantity(1);
          setItemDescription(description);
        }
        setShowNewArticle(false);
        resetNewArticleForm();
      }
    } finally {
      setIsCreatingArticle(false);
    }
  }, [newArticle, newArticleFournisseurs, resetNewArticleForm]);

  // Load product groups when variant dialog opens
  useEffect(() => {
    if (!showAddVariant) return;
    const loadGroups = async () => {
      const { data } = await supabase.from('product_groups').select('id, name, base_sku, category').order('name');
      setProductGroups(data || []);
    };
    loadGroups();
  }, [showAddVariant]);

  useEffect(() => {
    if (!selectedGroupId) return;
    const fetchLastSku = async () => {
      const { data } = await supabase
        .from('products')
        .select('sku')
        .eq('product_group_id', Number(selectedGroupId))
        .order('created_at', { ascending: false })
        .limit(1);
      const group = productGroups.find(g => g.id.toString() === selectedGroupId);
      let baseSku = data?.[0]?.sku || group?.base_sku || group?.name.substring(0, 3).toUpperCase() || '';
      // Strip existing size/color suffixes to get clean base
      const parts = baseSku.split('-');
      // Keep only the base part (first segment)
      baseSku = parts[0];
      if (variantSize) baseSku += `-${variantSize}`;
      if (variantColor) baseSku += `-${variantColor}`;
      setVariantSku(baseSku);
    };
    fetchLastSku();
  }, [selectedGroupId, variantSize, variantColor, productGroups]);

  const handleCreateVariant = useCallback(async () => {
    if (!selectedGroupId) { toast.error('Sélectionnez un article'); return; }
    if (!variantSku.trim()) { toast.error('Code article requis'); return; }
    setIsCreatingVariant(true);
    try {
      const result = await createVariant(Number(selectedGroupId), {
        sku: variantSku.trim(),
        size: variantSize || undefined,
        color: variantColor || undefined,
        quantity: variantQuantity,
        price: 0,
        remise: 0,
      });
      if (!result.success) {
        toast.error(result.error || 'Erreur création variante');
      } else {
        toast.success('Variante créée avec succès');
        const group = productGroups.find(g => g.id.toString() === selectedGroupId);
        if (group) {
          setItemDesignation(group.name);
          setItemDescription(`${variantSku}${variantSize ? ` - Taille: ${variantSize}` : ''}${variantColor ? ` - ${variantColor}` : ''}`);
        }
        setShowAddVariant(false);
        setSelectedGroupId('');
        setVariantSku('');
        setVariantSize('');
        setVariantColor('');
        setVariantQuantity(0);
        setGroupSearch('');
      }
    } finally {
      setIsCreatingVariant(false);
    }
  }, [selectedGroupId, variantSku, variantSize, variantColor, variantQuantity, productGroups]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return productGroups;
    const q = groupSearch.toLowerCase();
    return productGroups.filter(g => g.name.toLowerCase().includes(q) || (g.base_sku || '').toLowerCase().includes(q));
  }, [productGroups, groupSearch]);

  const rawTotal = devisItems.reduce((s, i) => {
    const priceAfterRemise = i.remise > 0 ? i.prix_ttc * (1 - i.remise / 100) : i.prix_ttc;
    return s + priceAfterRemise * i.quantity;
  }, 0);
  const totalAmount = isTtc ? rawTotal : rawTotal / 1.19;
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

          {/* TTC / HT Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Mode de tarification</p>
              <p className="text-xs text-muted-foreground">
                {isTtc ? 'Les prix incluent la TVA (19%)' : 'Les prix sont Hors Taxes'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${!isTtc ? 'text-primary' : 'text-muted-foreground'}`}>HT</span>
              <button
                type="button"
                onClick={() => setIsTtc(!isTtc)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isTtc ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isTtc ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className={`text-xs font-medium ${isTtc ? 'text-primary' : 'text-muted-foreground'}`}>TTC</span>
            </div>
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddVariant(true)} className="text-xs">
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Ajouter Variante
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowNewArticle(true)} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Créer Article
                </Button>
              </div>
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
                      className="form-input !pl-10"
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

                  {/* Quantity, Price & Remise */}
                   <div className={`grid gap-3 ${devisType === 'sortant' ? 'grid-cols-4' : (isEntrant && isTtc ? 'grid-cols-4' : 'grid-cols-3')}`}>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qté</label>
                      <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input" />
                    </div>
                    {devisType === 'sortant' && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Prix Achat {isTtc ? 'TTC' : 'HT'}</label>
                        <input type="number" min="0" step="0.001" value={itemPrixAchat || ''} onChange={e => setItemPrixAchat(parseFloat(e.target.value) || 0)} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prix Vente {isEntrant ? 'HT' : (isTtc ? 'TTC' : 'HT')}</label>
                      <input type="number" min="0" step="0.001" value={itemPrixTtc || ''} onChange={e => setItemPrixTtc(parseFloat(e.target.value) || 0)} className="form-input" />
                    </div>
                    {isEntrant && isTtc && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Prix Vente TTC</label>
                        <input type="number" min="0" step="0.001" value={parseFloat((itemPrixTtc * 1.19).toFixed(3)) || ''} onChange={e => {
                          const ttcVal = parseFloat(e.target.value) || 0;
                          setItemPrixTtc(ttcVal / 1.19);
                        }} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Remise %</label>
                      <input type="number" min="0" max="100" step="0.1" value={itemRemise || ''} onChange={e => setItemRemise(parseFloat(e.target.value) || 0)} className="form-input" />
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
                   <div className={`grid gap-3 ${devisType === 'sortant' ? 'grid-cols-4' : (isEntrant && isTtc ? 'grid-cols-4' : 'grid-cols-3')}`}>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantité</label>
                      <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input" />
                    </div>
                    {devisType === 'sortant' && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Prix Achat {isTtc ? 'TTC' : 'HT'}</label>
                        <input type="number" min="0" step="0.001" value={itemPrixAchat || ''} onChange={e => setItemPrixAchat(parseFloat(e.target.value) || 0)} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prix Vente {isEntrant ? 'HT' : (isTtc ? 'TTC' : 'HT')}</label>
                      <input type="number" min="0" step="0.001" value={itemPrixTtc || ''} onChange={e => setItemPrixTtc(parseFloat(e.target.value) || 0)} className="form-input" />
                    </div>
                    {isEntrant && isTtc && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Prix Vente TTC</label>
                        <input type="number" min="0" step="0.001" value={parseFloat((itemPrixTtc * 1.19).toFixed(3)) || ''} onChange={e => {
                          const ttcVal = parseFloat(e.target.value) || 0;
                          setItemPrixTtc(ttcVal / 1.19);
                        }} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Remise %</label>
                      <input type="number" min="0" max="100" step="0.1" value={itemRemise || ''} onChange={e => setItemRemise(parseFloat(e.target.value) || 0)} className="form-input" />
                    </div>
                  </div>
                </>
              )}

              {itemDesignation.trim() && itemPrixTtc > 0 && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border text-center">
                  <span className="text-sm text-muted-foreground">Prix unitaire après remise : </span>
                  <span className="text-sm font-semibold text-foreground">
                    {(() => {
                      const afterRemise = itemRemise > 0 ? itemPrixTtc * (1 - itemRemise / 100) : itemPrixTtc;
                      if (isEntrant) {
                        const unitHT = afterRemise;
                        const unitTTC = unitHT * 1.19;
                        return isTtc
                          ? `${unitHT.toFixed(3)} HT — ${unitTTC.toFixed(3)} TTC`
                          : `${unitHT.toFixed(3)} HT`;
                      }
                      if (isTtc) {
                        const unitHT = afterRemise / 1.19;
                        return `${unitHT.toFixed(3)} HT — ${afterRemise.toFixed(3)} TTC`;
                      }
                      return `${afterRemise.toFixed(3)} HT`;
                    })()}
                  </span>
                </div>
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
            <Button variant="outline" onClick={onCancel} className="gap-2">
              <X className="w-4 h-4" /> Vider
            </Button>
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
              Total {isTtc ? 'TTC' : 'HT'}: {totalAmount.toFixed(3)} TND
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
                      Qté: {item.quantity}
                      {item.prix_achat != null && item.prix_achat > 0 && ` • Achat: ${item.prix_achat.toFixed(3)} TND`}
                      {` • P.U: ${item.prix_ttc.toFixed(3)} TND`}
                      {item.remise > 0 && ` • Remise: ${item.remise}% → ${(item.prix_ttc * (1 - item.remise / 100)).toFixed(3)} TND`}
                      {(() => {
                        const unitAfterRemise = item.remise > 0 ? item.prix_ttc * (1 - item.remise / 100) : item.prix_ttc;
                        return item.quantity > 1 ? ` = ${(unitAfterRemise * item.quantity).toFixed(3)} TND` : '';
                      })()}
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
                <Label>Couleur</Label>
                <Input list="devis-colors" value={newArticle.color} onChange={e => setNewArticle(p => ({ ...p, color: e.target.value }))} placeholder="Optionnel" />
                <datalist id="devis-colors">
                  {COLORS.map(c => <option key={c} value={c} />)}
                </datalist>
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

      {/* Add Variant Dialog */}
      <Dialog open={showAddVariant} onOpenChange={(open) => { if (!open) { setShowAddVariant(false); setSelectedGroupId(''); setVariantSku(''); setVariantSize(''); setVariantColor(''); setVariantQuantity(0); setGroupSearch(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Ajouter une Variante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search & select product group */}
            <div>
              <Label>Article existant *</Label>
              <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedGroupId
                      ? productGroups.find(g => g.id.toString() === selectedGroupId)?.name || 'Sélectionner...'
                      : 'Rechercher un article...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher..." value={groupSearch} onValueChange={setGroupSearch} />
                    <CommandList>
                      <CommandEmpty>Aucun article trouvé</CommandEmpty>
                      <CommandGroup>
                        {filteredGroups.map(g => (
                          <CommandItem
                            key={g.id}
                            value={`${g.name} ${g.base_sku || ''}`}
                            onSelect={() => { setSelectedGroupId(g.id.toString()); setGroupPopoverOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedGroupId === g.id.toString() ? "opacity-100" : "opacity-0")} />
                            <span className="font-medium">{g.name}</span>
                            <span className="text-muted-foreground text-xs ml-2">({g.base_sku || 'N/A'}) - {g.category}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Taille</Label>
                <Select value={variantSize} onValueChange={setVariantSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Taille" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Couleur</Label>
                <Select value={variantColor} onValueChange={setVariantColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Couleur" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Code Article (SKU)</Label>
              <Input value={variantSku} onChange={e => setVariantSku(e.target.value)} placeholder="Auto-généré" />
            </div>

            <div>
              <Label>Quantité initiale</Label>
              <Input type="number" min={0} value={variantQuantity} onChange={e => setVariantQuantity(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVariant(false)}>Annuler</Button>
            <Button onClick={handleCreateVariant} disabled={isCreatingVariant}>
              {isCreatingVariant ? 'Création...' : 'Créer Variante'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

DevisForm.displayName = 'DevisForm';

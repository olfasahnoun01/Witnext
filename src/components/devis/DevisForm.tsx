import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { ProductGroupFournisseur } from '@/types';
import { computeDevisTotals, computeDevisLine } from '@/lib/devisPricing';
import { Plus, Trash2, Edit, Building2, Users, Save, X, UserPlus, Search, Package, Layers, Truck, Check, AlertCircle, Upload, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  mapLightRowToProduct,
  pickPrixAchatHtFromFournisseurRows,
  prixAchatHtFromVariantProduct,
  searchInventoryProductsLight,
} from '@/lib/inventoryProductSearch';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { ClientDocumentPreviewDialog } from '@/components/shared/ClientDocumentPreviewDialog';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { PhoneLinesEditor } from '@/components/shared/PhoneLinesEditor';
import { formatPhonesDisplay, serializePhoneList } from '@/lib/phoneList';
import { validateUploadFile } from '@/lib/uploadValidation';

const DEFAULT_CATEGORIES = ['Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Non catégorisé'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];
const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Marron', 'Beige'];

const parseDecimalInput = (rawValue: string): number => {
  const value = rawValue.trim().replace(/\s/g, '');
  if (!value) return 0;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  let normalized = value;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = value.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = value.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Comme parseDecimalInput mais tolère un séparateur décimal en fin de chaîne (ex. « 12. » ou « 12, » pendant la frappe). */
const parseDecimalInputLoose = (rawValue: string): number => {
  const value = rawValue.trim().replace(/\s/g, '');
  if (!value) return 0;
  if (/[.,]$/.test(value)) return parseDecimalInput(value.slice(0, -1));
  return parseDecimalInput(value);
};

/** Affiche un nombre dans un input contrôlé (un `0` réel reste visible, contrairement à `value={n || ''}`). */
const formatDecimalFieldValue = (n: number) => (Number.isFinite(n) ? String(n) : '');

interface Fournisseur {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  patente_url?: string | null;
  registre_commerce_url?: string | null;
}

interface Client {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
}

interface DevisFormProps {
  devisType: 'achat' | 'vente';
  devisNumber: string;
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  documentStatus: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré';
  devisItems: DevisItem[];
  editingDevis: Devis | null;
  isSaving: boolean;
  isTtc: boolean;
  setDevisType: (t: 'achat' | 'vente') => void;
  setDevisNumber: (v: string) => void;
  setDevisDate: (v: string) => void;
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
  setNotes: (v: string) => void;
  setDocumentStatus: (v: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré') => void;
  setDevisItems: React.Dispatch<React.SetStateAction<DevisItem[]>>;
  setIsTtc: (v: boolean) => void;
  onSave: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  docType: 'devis' | 'bc' | 'ba';
  setDocType: (t: 'devis' | 'bc' | 'ba') => void;
  lockDevisType?: boolean;
  forceDocType?: 'devis' | 'bc';
}

export const DevisForm = memo(({
  devisType, devisNumber, devisDate,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone,
  notes, documentStatus, devisItems, editingDevis, isSaving, isTtc,
  setDevisType, setDevisNumber, setDevisDate,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone,
  setNotes, setDocumentStatus, setDevisItems, setIsTtc,
  onSave, onUpdate, onCancel,
  docType, setDocType, lockDevisType, forceDocType,
}: DevisFormProps) => {
  const isAchat = devisType === 'achat';

  // Third parties
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  // New fournisseur dialog
  const [showNewFournisseur, setShowNewFournisseur] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState('');
  const [newFournisseurMatricule, setNewFournisseurMatricule] = useState('');
  const [newFournisseurSpecialite, setNewFournisseurSpecialite] = useState('');
  const [newFournisseurGovernorate, setNewFournisseurGovernorate] = useState('');
  const [newFournisseurCity, setNewFournisseurCity] = useState('');
  const [newFournisseurCode, setNewFournisseurCode] = useState('');
  const [newFournisseurPhoneLines, setNewFournisseurPhoneLines] = useState<string[]>(['']);
  const [newFournisseurPatenteUrl, setNewFournisseurPatenteUrl] = useState<string | null>(null);
  const [newFournisseurRneUrl, setNewFournisseurRneUrl] = useState<string | null>(null);
  const { preview: documentPreview, pdfBytesRef, openDocumentPreview, closePreview: closeDocumentPreview } =
    useClientDocumentPreview();

  // Article mode: 'search' | 'manual'
  const [articleMode, setArticleMode] = useState<'search' | 'manual'>('search');

  // Search existing products
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const achatPriceRequestRef = useRef(0);

  // Item form (manual or from selected product)
  const [itemDesignation, setItemDesignation] = useState('');
  const [itemFournisseur, setItemFournisseur] = useState('');
  const [itemPrixTtc, setItemPrixTtc] = useState<number>(0);
  /** Brouillon PU vente HT (devis vente) pour afficher « 12. » sans perdre le point avant blur. */
  const [itemPrixVenteDraft, setItemPrixVenteDraft] = useState<string | null>(null);
  const [itemRemise, setItemRemise] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrixAchat, setItemPrixAchat] = useState<number>(0);
  const [itemTva, setItemTva] = useState<number>(19);

  /** Remplit prix d'achat HT depuis l'inventaire (fournisseurs du groupe). */
  const loadPrixAchatFromInventoryProduct = useCallback(
    (product: { id: number; name?: string; product_group_id?: number | null; fournisseur?: string | null }) => {
      const req = ++achatPriceRequestRef.current;

      void (async () => {
        const { data: prow } = await supabase
          .from('products')
          .select('product_group_id, name, fournisseur, price')
          .eq('id', product.id)
          .maybeSingle();

        if (achatPriceRequestRef.current !== req) return;

        let groupId = product.product_group_id ?? prow?.product_group_id ?? null;
        const prodName = (prow?.name || product.name || '').trim();
        if (!groupId && prodName) {
          const { data: glist } = await supabase.from('product_groups').select('id').eq('name', prodName).limit(1);
          if (achatPriceRequestRef.current !== req) return;
          groupId = glist?.[0]?.id ?? null;
        }
        if (!groupId) {
          const fromVariantNoGroup = prixAchatHtFromVariantProduct(prow?.price);
          if (fromVariantNoGroup !== undefined) setItemPrixAchat(fromVariantNoGroup);
          return;
        }

        const { data, error } = await supabase
          .from('product_group_fournisseurs')
          .select('prix_ttc, fournisseur_name')
          .eq('product_group_id', groupId);

        if (achatPriceRequestRef.current !== req) return;
        if (error) {
          console.warn('[DevisForm] prix achat (fournisseurs):', error.message);
          const fromVariantOnErr = prixAchatHtFromVariantProduct(prow?.price);
          if (fromVariantOnErr !== undefined) setItemPrixAchat(fromVariantOnErr);
          return;
        }
        const fournLabel = prow?.fournisseur ?? product.fournisseur;
        const n = pickPrixAchatHtFromFournisseurRows(data || [], fournLabel);
        if (n !== undefined) {
          setItemPrixAchat(n);
          return;
        }
        const fromVariant = prixAchatHtFromVariantProduct(prow?.price);
        if (fromVariant !== undefined) setItemPrixAchat(fromVariant);
      })();
    },
    []
  );

  // New article dialog (full product creation popup)
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState({
    name: '', sku: '', category: '', size: '', quantity: 0, min_stock: 5, image: null as string | null, color: '',
  });
  const [newArticleFournisseurs, setNewArticleFournisseurs] = useState<ProductGroupFournisseur[]>([]);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newArticleFicheFiles, setNewArticleFicheFiles] = useState<File[]>([]);
  const newArticleFicheRef = useRef<HTMLInputElement>(null);

  // Add variant to existing product group
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [productGroups, setProductGroups] = useState<{ id: number; name: string; base_sku: string | null; category: string; fournisseur: string | null }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantColor, setVariantColor] = useState('');
  const [variantQuantity, setVariantQuantity] = useState(0);
  const [variantPrice, setVariantPrice] = useState(0);
  const [variantRemise, setVariantRemise] = useState(0);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [variantFicheFiles, setVariantFicheFiles] = useState<File[]>([]);
  const variantFicheRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [fRes, cRes, catSettingsRes, productsCatsRes, groupCatsRes] = await Promise.all([
        supabase.from('fournisseurs').select('id, nom, matricule_fiscale, location, phone, patente_url, registre_commerce_url').order('nom'),
        supabase.from('clients').select('id, nom, matricule_fiscale, location, phone').order('nom'),
        supabase.from('category_settings').select('category_name'),
        supabase.from('products').select('category'),
        supabase.from('product_groups').select('category'),
      ]);
      if (fRes.data) setFournisseurs(fRes.data);
      if (cRes.data) setClients(cRes.data);
      const allCats = new Set<string>(DEFAULT_CATEGORIES);
      (catSettingsRes.data || []).forEach((row: { category_name: string | null }) => {
        if (row.category_name) allCats.add(row.category_name);
      });
      (productsCatsRes.data || []).forEach((row: { category: string | null }) => {
        if (row.category?.trim()) allCats.add(row.category.trim());
      });
      (groupCatsRes.data || []).forEach((row: { category: string | null }) => {
        if (row.category?.trim()) allCats.add(row.category.trim());
      });
      setDbCategories([...allCats].sort());
    };
    load();
  }, []);

  // Search products — substring on name or sku; merged list (not "starts with" only, not capped at 10).
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const search = async () => {
      setIsSearching(true);
      const rows = await searchInventoryProductsLight({
        searchTerm: debouncedSearch,
        perBranchLimit: 120,
        maxResults: 150,
        fournisseurExact: isAchat && thirdPartyName.trim() ? thirdPartyName.trim() : null,
      });
      if (cancelled) return;
      setSearchResults(rows.map(mapLightRowToProduct));
      setIsSearching(false);
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, isAchat, thirdPartyName]);

  const selectExistingProduct = useCallback((product: Product) => {
    achatPriceRequestRef.current += 1;
    setSelectedProduct(product);
    setItemDesignation(product.name);
    setItemFournisseur(product.fournisseur || '');
    if (isAchat) {
      const priceHt = product.price || 0;
      setItemPrixTtc(priceHt);
      setItemPrixVenteDraft(null);
      setItemPrixAchat(0);
      setItemRemise(product.remise || 0);
    } else {
      // Devis vente : PU vente HT à saisir ; prix achat HT = net HT inventaire (prix × (1 − remise variante))
      setItemPrixVenteDraft(null);
      const p = Number(product.price);
      const r = Number(product.remise ?? 0);
      const netHt = Number.isFinite(p) ? p * (1 - (Number.isFinite(r) ? r : 0) / 100) : 0;
      setItemPrixTtc(0);
      const achatFromSearch =
        typeof product.prix_achat_ht === 'number' && Number.isFinite(product.prix_achat_ht)
          ? product.prix_achat_ht
          : undefined;
      const achat =
        Number.isFinite(netHt) && netHt > 0
          ? netHt
          : achatFromSearch ?? prixAchatHtFromVariantProduct(product.price) ?? 0;
      setItemPrixAchat(achat);
      setItemRemise(0);
      if (achat <= 0) loadPrixAchatFromInventoryProduct(product);
    }
    setItemQuantity(1);
    setItemDescription(`${product.sku}${product.size ? ` - Taille: ${product.size}` : ''}${product.color ? ` - ${product.color}` : ''}`);
    setProductSearch('');
    setSearchResults([]);
  }, [isAchat, loadPrixAchatFromInventoryProduct]);

  useEffect(() => {
    setSelectedThirdPartyId('');
    setItemPrixVenteDraft(null);
  }, [devisType]);

  const handleThirdPartyNameChange = useCallback((value: string) => {
    const trimmed = value.trim();
    const list = isAchat ? fournisseurs : clients;
    const match = list.find(item => item.nom.trim().toLowerCase() === trimmed.toLowerCase());

    setThirdPartyName(value);
    if (!trimmed) {
      setThirdPartyAddress('');
      setThirdPartyTaxId('');
      setThirdPartyPhone('');
      setSelectedThirdPartyId('');
      return;
    }

    if (match) {
      setThirdPartyAddress(match.location || '');
      setThirdPartyTaxId(match.matricule_fiscale || '');
      setThirdPartyPhone(formatPhonesDisplay(match.phone) || '');
      setSelectedThirdPartyId(match.id.toString());
    } else {
      setThirdPartyAddress('');
      setThirdPartyTaxId('');
      setThirdPartyPhone('');
      setSelectedThirdPartyId('');
    }
  }, [isAchat, fournisseurs, clients, setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone]);

  const filteredThirdParties = useMemo(() => {
    const query = thirdPartyName.trim().toLowerCase();
    if (!query) return [];
    const list = isAchat ? fournisseurs : clients;
    return list
      .filter(item => {
        const normalizedName = item.nom.trim().toLowerCase();
        return normalizedName.includes(query) && normalizedName !== query;
      })
      .slice(0, 8);
  }, [isAchat, fournisseurs, clients, thirdPartyName]);

  const handleThirdPartySuggestionSelect = useCallback((item: Fournisseur | Client) => {
    setThirdPartyName(item.nom);
    setThirdPartyAddress(item.location || '');
    setThirdPartyTaxId(item.matricule_fiscale || '');
    setThirdPartyPhone(formatPhonesDisplay(item.phone) || '');
    setSelectedThirdPartyId(item.id.toString());
  }, [setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone]);

  const newFournisseurCities = useMemo(() => {
    return newFournisseurGovernorate
      ? TUNISIA_LOCATIONS.find(r => r.governorate === newFournisseurGovernorate)?.cities || []
      : [];
  }, [newFournisseurGovernorate]);

  const resetNewFournisseurForm = useCallback(() => {
    setNewFournisseurName('');
    setNewFournisseurMatricule('');
    setNewFournisseurSpecialite('');
    setNewFournisseurGovernorate('');
    setNewFournisseurCity('');
    setNewFournisseurCode('');
    setNewFournisseurPhoneLines(['']);
    setNewFournisseurPatenteUrl(null);
    setNewFournisseurRneUrl(null);
  }, []);

  const createFournisseur = useCallback(async () => {
    if (!newFournisseurName.trim()) { toast.error('Nom requis'); return; }
    if (!newFournisseurSpecialite) { toast.error('Spécialité requise'); return; }
    if (!newFournisseurMatricule.trim()) { toast.error('Matricule fiscal requis'); return; }
    const phoneStored = serializePhoneList(newFournisseurPhoneLines);
    if (!phoneStored) { toast.error('Au moins un numéro de téléphone est requis'); return; }
    if (!newFournisseurCode.trim()) { toast.error('Code fournisseur requis pour les documents'); return; }
    if (!newFournisseurGovernorate || !newFournisseurCity) {
      toast.error('Gouvernorat et ville requis');
      return;
    }

    const locationValue = `${newFournisseurCity}, ${newFournisseurGovernorate}`;

    const { data, error } = await supabase.from('fournisseurs').insert({
      nom: newFournisseurName.trim(),
      code: newFournisseurCode.trim(),
      matricule_fiscale: newFournisseurMatricule.trim(),
      specialite: newFournisseurSpecialite,
      phone: phoneStored,
      location: locationValue,
      patente_url: newFournisseurPatenteUrl,
      registre_commerce_url: newFournisseurRneUrl,
    }).select().single();
    if (error) {
      toast.error('Erreur création fournisseur');
    } else if (data) {
      toast.success('Fournisseur créé');
      setFournisseurs(prev => [...prev, data as Fournisseur].sort((a, b) => a.nom.localeCompare(b.nom)));
      if (isAchat) {
        setThirdPartyName(data.nom);
        setThirdPartyPhone(formatPhonesDisplay((data as Fournisseur).phone) || '');
        setThirdPartyAddress((data as Fournisseur).location || '');
        setThirdPartyTaxId((data as Fournisseur).matricule_fiscale || '');
        setSelectedThirdPartyId(data.id.toString());
      }
      setShowNewFournisseur(false);
      resetNewFournisseurForm();
    }
  }, [newFournisseurName, newFournisseurMatricule, newFournisseurSpecialite, newFournisseurGovernorate, newFournisseurCity, newFournisseurCode, newFournisseurPhoneLines, newFournisseurPatenteUrl, newFournisseurRneUrl, isAchat, setThirdPartyName, setThirdPartyPhone, setThirdPartyAddress, setThirdPartyTaxId, resetNewFournisseurForm]);

  const addItem = useCallback(() => {
    if (!itemDesignation.trim()) { toast.error('Nom d\'article requis'); return; }
    if (devisType === 'vente' && itemPrixTtc <= 0) {
      toast.error('Indiquez le prix de vente HT');
      return;
    }
    
    const designationLines =
      articleMode === 'manual'
        ? [itemDesignation.trim()].filter(Boolean)
        : itemDesignation.split(',').map(d => d.trim()).filter(d => d !== '');
    if (designationLines.length === 0) return;

    const lineFournisseur =
      articleMode === 'manual' && isAchat
        ? thirdPartyName.trim()
        : itemFournisseur.trim();

    const newItems = designationLines.map(name => ({
      line_id: Math.random().toString(36).substring(7),
      designation: name,
      fournisseur: lineFournisseur,
      prix_ttc: itemPrixTtc,
      remise: itemRemise,
      quantity: itemQuantity,
      description: itemDescription.trim() || undefined,
      tva: itemTva,
      ...(devisType === 'vente' ? { prix_achat: itemPrixAchat } : {}),
      ...(selectedProduct?.sku ? { sku: selectedProduct.sku } : {}),
      product_id: selectedProduct?.id,
    }));

    setDevisItems(prev => [...prev, ...newItems]);

    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemRemise(0);
    setItemQuantity(1);
    setItemDescription('');
    setItemPrixAchat(0);
    setItemTva(19);
    setProductSearch('');
    setSearchResults([]);
    setSelectedProduct(null);
    setItemPrixVenteDraft(null);
    achatPriceRequestRef.current += 1;
  }, [itemDesignation, itemFournisseur, itemPrixTtc, itemRemise, itemQuantity, itemDescription, itemPrixAchat, itemTva, devisType, articleMode, isAchat, thirdPartyName, setDevisItems]);



  const removeItem = useCallback((idx: number) => {
    setDevisItems(prev => prev.filter((_, i) => i !== idx));
  }, [setDevisItems]);

  // Inline edit state for devis items
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editItemDesignation, setEditItemDesignation] = useState('');
  const [editItemFournisseur, setEditItemFournisseur] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemPrix, setEditItemPrix] = useState<number>(0);
  const [editItemQty, setEditItemQty] = useState<number>(1);
  const [editItemPrixAchat, setEditItemPrixAchat] = useState<number>(0);
  const [editItemRemise, setEditItemRemise] = useState<number>(0);
  const [editItemTva, setEditItemTva] = useState<number>(19);

  const startEditItem = useCallback((idx: number) => {
    const item = devisItems[idx];
    setEditingItemIdx(idx);
    setEditItemDesignation(item.designation);
    setEditItemFournisseur(item.fournisseur || '');
    setEditItemDescription(item.description || '');
    setEditItemPrix(item.prix_ttc);
    setEditItemQty(item.quantity);
    setEditItemPrixAchat(item.prix_achat || 0);
    setEditItemRemise(item.remise || 0);
    setEditItemTva(item.tva ?? 19);
  }, [devisItems]);

  const saveEditItem = useCallback(() => {
    if (editingItemIdx === null) return;
    if (!editItemDesignation.trim()) {
      toast.error('Nom d\'article requis');
      return;
    }
    setDevisItems(prev => prev.map((item, i) => i === editingItemIdx ? {
      ...item,
      designation: editItemDesignation.trim(),
      fournisseur: editItemFournisseur.trim(),
      description: editItemDescription.trim() || undefined,
      prix_ttc: editItemPrix,
      quantity: editItemQty,
      remise: editItemRemise,
      tva: editItemTva,
      ...(devisType === 'vente' ? { prix_achat: editItemPrixAchat } : {}),
    } : item));
    setEditingItemIdx(null);
  }, [editingItemIdx, editItemDesignation, editItemFournisseur, editItemDescription, editItemPrix, editItemQty, editItemRemise, editItemTva, editItemPrixAchat, devisType, setDevisItems]);

  const cancelEditItem = useCallback(() => {
    setEditingItemIdx(null);
  }, []);

  // New article creation
  const resetNewArticleForm = useCallback(() => {
    setNewArticle({ name: '', sku: '', category: '', size: '', quantity: 0, min_stock: 5, image: null, color: '' });
    setNewArticleFournisseurs([]);
    setNewArticleFicheFiles([]);
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
            setNewArticle(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 1.0) }));
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
          fiche_technique_url: f.fiche_technique_url || null,
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
        // Upload fiche technique files for the first variant
        const firstVariantId = data[0].id;
        if (newArticleFicheFiles.length > 0 && firstVariantId) {
          try {
            const { convertImageFileToJpeg, convertPdfAllPagesToJpeg } = await import('@/lib/imageCompression');
            const uploadedUrls: string[] = [];

            for (const file of newArticleFicheFiles) {
              const check = validateUploadFile(file, [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp',
              ]);
              if (!check.ok) {
                toast.error(check.message);
                continue;
              }
              let blobs: { blob: Blob; ext: string }[] = [];
              if (file.type === 'application/pdf') {
                blobs = await convertPdfAllPagesToJpeg(file, { maxWidth: 5000, maxHeight: 5000, quality: 1.0 });
                toast.info(`PDF "${file.name}": ${blobs.length} page(s) convertie(s) en JPEG`);
              } else {
                const convResult = await convertImageFileToJpeg(file);
                blobs = [convResult];
              }
              for (const { blob, ext } of blobs) {
                const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const filePath = `fiches/${fileName}`;
                const { error: uploadError } = await supabase.storage
                  .from('fiches-techniques')
                  .upload(filePath, blob, { contentType: 'image/jpeg' });
                if (uploadError) {
                  console.error('Storage upload error:', uploadError);
                  toast.error(`Erreur upload: ${uploadError.message}`);
                  continue;
                }
                const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
                if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
              }
            }

            if (uploadedUrls.length > 0) {
              const fichePayload = uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);
              const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
                _product_id: firstVariantId,
                _fiche_technique_url: fichePayload,
              });
              if (rpcError) {
                console.error('RPC fiche error:', rpcError);
                toast.error(`Erreur sauvegarde fiche: ${rpcError.message}`);
              } else {
                toast.success(`${uploadedUrls.length} fiche(s) technique(s) uploadée(s)`);
              }
            }
          } catch (ficheErr) {
            console.error('Fiche technique upload error:', ficheErr);
            toast.error('Erreur lors de l\'upload des fiches techniques');
          }
        }

        toast.success('Article créé avec succès');
        const first = data[0];
        const description = `${first.sku}${first.size ? ` - Taille: ${first.size}` : ''}${first.color ? ` - ${first.color}` : ''}`;

        if (data.length > 1) {
          const newItems = data.map(d => ({
            line_id: Math.random().toString(36).substring(7),
            designation: d.name,
            fournisseur: d.fournisseur || '',
            prix_ttc: devisType === 'vente' ? 0 : (d.price || 0),
            remise: devisType === 'vente' ? 0 : (d.remise || 0),
            quantity: 1,
            description: `${d.sku}${d.size ? ` - Taille: ${d.size}` : ''}${d.color ? ` - ${d.color}` : ''}`.trim() || undefined,
            sku: d.sku || undefined,
            product_id: d.id,
          }));
          setDevisItems(prev => [...prev, ...newItems]);
          setItemDesignation('');
          setItemFournisseur('');
          setItemPrixTtc(0);
          setItemPrixVenteDraft(null);
          setItemQuantity(1);
          setItemDescription('');
          setSelectedProduct(null);
        } else {
          setItemDesignation(first.name);
          setItemFournisseur(first.fournisseur || '');
          setItemQuantity(1);
          setItemDescription(description);
          setSelectedProduct(first as Product);
          if (devisType === 'vente') {
            setItemPrixTtc(0);
            setItemPrixVenteDraft(null);
            setItemRemise(0);
            setItemPrixAchat(0);
            loadPrixAchatFromInventoryProduct({
              id: first.id,
              name: first.name,
              product_group_id: (first as { product_group_id?: number | null }).product_group_id ?? null,
              fournisseur: first.fournisseur,
            });
          } else {
            setItemPrixTtc(first.price || 0);
            setItemRemise(first.remise || 0);
          }
        }
        setShowNewArticle(false);
        resetNewArticleForm();
      }
    } finally {
      setIsCreatingArticle(false);
    }
  }, [newArticle, newArticleFournisseurs, newArticleFicheFiles, resetNewArticleForm, devisType, loadPrixAchatFromInventoryProduct]);

  // Load product groups when variant dialog opens
  useEffect(() => {
    if (!showAddVariant) return;
    const loadGroups = async () => {
      const { data } = await supabase.from('product_groups').select('id, name, base_sku, category, fournisseur').order('name');
      setProductGroups(data || []);
    };
    loadGroups();
  }, [showAddVariant]);

  const [lastVariantFullSku, setLastVariantFullSku] = useState('');

  // Fetch last variant SKU when group is selected
  useEffect(() => {
    if (!selectedGroupId) { setLastVariantFullSku(''); setVariantSku(''); return; }
    const fetchNextSku = async () => {
      const group = productGroups.find(g => g.id.toString() === selectedGroupId);
      const baseSku = group?.base_sku || group?.name.substring(0, 3).toUpperCase() || '';

      // Fetch all variant SKUs for this group to find the next number
      const { data } = await supabase
        .from('products')
        .select('sku')
        .eq('product_group_id', Number(selectedGroupId));

      if (!data || data.length === 0) {
        // No variants yet — start with baseSku-1
        setLastVariantFullSku(`${baseSku}-1`);
        setVariantSku(`${baseSku}-1`);
        return;
      }

      // Extract numeric suffixes from SKUs that match baseSku-{number} pattern
      let maxNum = 0;
      const basePattern = baseSku.toLowerCase();
      data.forEach(v => {
        const sku = v.sku.toLowerCase();
        // Match baseSku-NUMBER or baseSku-SIZE-COLOR patterns, extract first number after base
        if (sku.startsWith(basePattern)) {
          const rest = v.sku.substring(baseSku.length);
          // Try to find a leading -NUMBER
          const match = rest.match(/^-(\d+)/);
          if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
          }
        }
      });

      const nextNum = maxNum + 1;
      const nextSku = `${baseSku}-${nextNum}`;
      setLastVariantFullSku(nextSku);
      setVariantSku(nextSku);
    };
    fetchNextSku();
  }, [selectedGroupId, productGroups]);

  // Append size/color when changed
  useEffect(() => {
    if (!lastVariantFullSku) return;
    let sku = lastVariantFullSku;
    if (variantSize) sku += `-${variantSize}`;
    if (variantColor) sku += `-${variantColor}`;
    setVariantSku(sku);
  }, [lastVariantFullSku, variantSize, variantColor]);

  const handleCreateVariant = useCallback(async () => {
    if (!selectedGroupId) { toast.error('Sélectionnez un article'); return; }
    if (!variantSku.trim()) { toast.error('Code article requis'); return; }
    // Check if SKU already exists
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', variantSku.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error('Ce Code Article existe déjà. Veuillez en choisir un autre.');
      return;
    }
    setIsCreatingVariant(true);
    try {
      const result = await createVariant(Number(selectedGroupId), {
        sku: variantSku.trim(),
        size: variantSize || undefined,
        color: variantColor || undefined,
        quantity: variantQuantity,
        price: variantPrice || 0,
        remise: variantRemise || 0,
      });
      if (!result.success) {
        toast.error(result.error || 'Erreur création variante');
      } else {
        // Upload fiche technique files — convert all to JPEG
        if (variantFicheFiles.length > 0 && result.id) {
          try {
            const { convertImageFileToJpeg, convertPdfAllPagesToJpeg } = await import('@/lib/imageCompression');
            const uploadedUrls: string[] = [];

            for (const file of variantFicheFiles) {
              const check = validateUploadFile(file, [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp',
              ]);
              if (!check.ok) {
                toast.error(check.message);
                continue;
              }
              let blobs: { blob: Blob; ext: string }[] = [];

              if (file.type === 'application/pdf') {
                blobs = await convertPdfAllPagesToJpeg(file, { maxWidth: 5000, maxHeight: 5000, quality: 1.0 });
              } else {
                const convResult = await convertImageFileToJpeg(file);
                blobs = [convResult];
              }

              for (const { blob, ext } of blobs) {
                const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const filePath = `fiches/${fileName}`;
                const { error: uploadError } = await supabase.storage
                  .from('fiches-techniques')
                  .upload(filePath, blob, { contentType: 'image/jpeg' });
                if (uploadError) {
                  console.error('Storage upload error:', uploadError);
                  toast.error(`Erreur upload: ${uploadError.message}`);
                  continue;
                }
                const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
                if (urlData?.publicUrl) {
                  uploadedUrls.push(urlData.publicUrl);
                }
              }
            }

            if (uploadedUrls.length > 0) {
              const fichePayload = uploadedUrls.length === 1
                ? uploadedUrls[0]
                : JSON.stringify(uploadedUrls);

              const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
                _product_id: result.id,
                _fiche_technique_url: fichePayload,
              });
              if (rpcError) {
                console.error('RPC fiche error:', rpcError);
                toast.error(`Erreur sauvegarde fiche: ${rpcError.message}`);
              } else {
                toast.success(`${uploadedUrls.length} fiche(s) technique(s) uploadée(s)`);
              }
            }
          } catch (e: any) {
            console.error('Fiche upload error:', e);
            toast.error(`Erreur traitement fiches: ${e.message || e}`);
          }
        }
        toast.success('Variante créée avec succès');
        const group = productGroups.find(g => g.id.toString() === selectedGroupId);
        if (group) {
          setItemDesignation(group.name);
          setItemFournisseur(group.fournisseur || '');
          setItemDescription(`${variantSku}${variantSize ? ` - Taille: ${variantSize}` : ''}${variantColor ? ` - ${variantColor}` : ''}`);
          setSelectedProduct({
            id: result.id,
            name: group.name,
            sku: variantSku,
            price: variantPrice,
            remise: variantRemise,
            quantity: variantQuantity,
            fournisseur: group.fournisseur || '',
            product_group_id: Number(selectedGroupId),
          } as Product);
          if (devisType === 'vente') {
            setItemPrixTtc(0);
            setItemPrixVenteDraft(null);
            setItemRemise(0);
            setItemPrixAchat(0);
            loadPrixAchatFromInventoryProduct({
              id: result.id,
              name: group.name,
              product_group_id: Number(selectedGroupId),
              fournisseur: group.fournisseur,
            });
          }
        }
        setShowAddVariant(false);
        setSelectedGroupId('');
        setVariantSku('');
        setVariantSize('');
        setVariantColor('');
        setVariantQuantity(0);
        setVariantPrice(0);
        setVariantRemise(0);
        setGroupSearch('');
        setVariantFicheFiles([]);
      }
    } finally {
      setIsCreatingVariant(false);
    }
  }, [selectedGroupId, variantSku, variantSize, variantColor, variantQuantity, productGroups, variantFicheFiles, devisType, loadPrixAchatFromInventoryProduct]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return productGroups;
    const q = groupSearch.toLowerCase();
    return productGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [productGroups, groupSearch]);

  // Lignes devis: `prix_ttc` = PU HT avant remise ; remise % et TVA s'appliquent sur ce PU vente HT uniquement
  const devisTotals = useMemo(() => computeDevisTotals(devisItems, false), [devisItems]);
  const totalAmount = devisTotals.totalFinal;
  const thirdPartyList = isAchat ? fournisseurs : clients;
  const ThirdPartyIcon = isAchat ? Building2 : Users;
  const thirdPartyLabel = isAchat ? 'Fournisseur' : 'Client';
  const thirdPartyRole = isAchat ? 'Expéditeur' : 'Destinataire';

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-12rem)]">
        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6 lg:overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {editingDevis 
                ? `Modifier ${docType === 'bc' ? 'Bon de Commande' : 'Devis'}` 
                : `Nouveau ${docType === 'bc' ? 'Bon de Commande' : 'Devis'}`}
            </h3>
            {editingDevis && (
              <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
            )}
          </div>

          {/* Document Mode Selector - Only if not editing and not forcing a specific document type */}
          {!editingDevis && !forceDocType && (
            <div>
              <label className="form-label">Mode du Document</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDocType('devis')}
                  className={`p-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${docType === 'devis'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                >
                  📄 Devis
                </button>
                <button
                  onClick={() => setDocType('bc')}
                  className={`p-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${docType === 'bc'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                >
                  🛒 Bon de Commande
                </button>

              </div>
            </div>
          )}

          {!forceDocType && (
            <div>
              <label className="form-label">
                Flux du {docType === 'bc' ? 'Bon de Commande' : 'Devis'}
              </label>
              {lockDevisType ? (
                <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm text-foreground">
                  📤 {devisType === 'vente' ? 'Devis Vente' : 'Devis Achat'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDevisType('achat')}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${devisType === 'achat'
                        ? 'border-success bg-success/10 text-success'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                  >
                    📥 Devis Achat
                  </button>
                  <button
                    onClick={() => setDevisType('vente')}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${devisType === 'vente'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                  >
                    {docType === 'devis' ? '📤 Devis Vente' : '📤 BC Vente'}
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {isAchat
                  ? docType === 'bc'
                    ? '⬇️ Un fournisseur nous envoie sa commande'
                    : '⬇️ Un fournisseur nous envoie un devis (nous sommes le récepteur)'
                  : docType === 'bc'
                    ? '⬆️ Nous envoyons une commande à un client'
                    : '⬆️ Nous envoyons un devis à un client'}
              </p>
            </div>
          )}

          {/* TTC / HT Switch */}
          {(
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTtc ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isTtc ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
                <span className={`text-xs font-medium ${isTtc ? 'text-primary' : 'text-muted-foreground'}`}>TTC</span>
              </div>
            </div>
          )}

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

          {docType === 'bc' && (
            <div>
              <label className="form-label">Statut BC</label>
              <Select
                value={documentStatus}
                onValueChange={(v) => setDocumentStatus(v as 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="envoyé">Envoyé</SelectItem>
                  <SelectItem value="confirmé">Confirmé</SelectItem>
                  <SelectItem value="reçu">Reçu</SelectItem>
                  <SelectItem value="intégré">Intégré</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Third Party */}
          <div className={`p-4 rounded-xl ${isAchat ? 'bg-success/5 border border-success/20' : 'bg-primary/5 border border-primary/20'}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-medium flex items-center gap-2 ${isAchat ? 'text-success' : 'text-primary'}`}>
                <ThirdPartyIcon className="w-4 h-4" />
                {thirdPartyLabel} <span className="text-xs text-muted-foreground">({thirdPartyRole})</span>
              </h4>
              {isAchat && (
                <Button variant="ghost" size="sm" onClick={() => setShowNewFournisseur(true)} className="text-xs">
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Nouveau
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={thirdPartyName}
                  onChange={e => handleThirdPartyNameChange(e.target.value)}
                  className="form-input"
                  placeholder={`Tapez le nom du ${thirdPartyLabel.toLowerCase()}...`}
                />
                {filteredThirdParties.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-20 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-md">
                    {filteredThirdParties.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={() => handleThirdPartySuggestionSelect(item)}
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                      >
                        {item.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                type="button"
                onClick={() => {
                  achatPriceRequestRef.current += 1;
                  setArticleMode('search');
                  setSelectedProduct(null);
                  setItemDesignation('');
                  setItemFournisseur('');
                  setItemPrixTtc(0);
                  setItemPrixVenteDraft(null);
                  setItemDescription('');
                }}
                className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${articleMode === 'search' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
              >
                <Search className="w-3.5 h-3.5" /> Sélectionner existant
              </button>
              <button
                type="button"
                onClick={() => {
                  achatPriceRequestRef.current += 1;
                  setArticleMode('manual');
                  setSelectedProduct(null);
                  setItemDesignation('');
                  setItemFournisseur('');
                  setItemPrixTtc(0);
                  setItemPrixVenteDraft(null);
                  setItemDescription('');
                }}
                className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${articleMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
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
                                {p.sku} • {p.category}{p.size ? ` • ${p.size}` : ''}{p.color ? ` • ${p.color}` : ''} • {p.price.toFixed(3)} HT
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
                      <p className="text-xs text-muted-foreground">
                        {selectedProduct.sku}
                        {isAchat
                          ? ` — PU ${selectedProduct.price.toFixed(3)} HT`
                          : ' — Prix d\'achat HT prérempli avec le net HT inventaire (prix × (1 − remise variante)) ; si absent, tarif fournisseur du groupe ou prix HT variante. Saisissez le PU vente HT ; remise et TVA du devis s\'appliquent au prix de vente uniquement.'}
                      </p>
                    </div>
                  )}

                  {/* Quantity, Price & Remise */}
                  <div className={`grid gap-3 ${devisType === 'vente' ? (isTtc ? 'grid-cols-6' : 'grid-cols-4') : (isTtc ? 'grid-cols-5' : 'grid-cols-3')}`}>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qté</label>
                      <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="form-input" />
                    </div>
                    {devisType === 'vente' && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Prix Achat HT</label>
                        <input type="text" inputMode="decimal" value={formatDecimalFieldValue(itemPrixAchat)} onChange={e => setItemPrixAchat(parseDecimalInput(e.target.value))} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat HT' : 'Prix Vente HT'}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          devisType === 'vente'
                            ? (itemPrixVenteDraft ?? formatDecimalFieldValue(itemPrixTtc))
                            : formatDecimalFieldValue(itemPrixTtc)
                        }
                        onChange={e => {
                          if (devisType === 'vente') {
                            setItemPrixVenteDraft(e.target.value);
                            setItemPrixTtc(parseDecimalInputLoose(e.target.value));
                          } else {
                            setItemPrixTtc(parseDecimalInput(e.target.value));
                          }
                        }}
                        onFocus={
                          devisType === 'vente'
                            ? () =>
                                setItemPrixVenteDraft(
                                  itemPrixTtc === 0 ? '' : formatDecimalFieldValue(itemPrixTtc)
                                )
                            : undefined
                        }
                        onBlur={devisType === 'vente' ? () => setItemPrixVenteDraft(null) : undefined}
                        className="form-input"
                        placeholder={devisType === 'vente' ? 'Saisir le PU vente HT' : undefined}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Remise %</label>
                      <input type="text" inputMode="decimal" value={itemRemise || ''} onChange={e => setItemRemise(parseDecimalInput(e.target.value))} className="form-input" />
                    </div>
                    {isTtc && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">TVA %</label>
                        <select value={String(itemTva)} onChange={e => setItemTva(Number(e.target.value))} className="form-input">
                          <option value="7">7%</option>
                          <option value="13">13%</option>
                          <option value="19">19%</option>
                        </select>
                      </div>
                    )}
                    {isTtc && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat TTC unit.' : 'Prix Vente TTC unit. (après remise)'}</label>
                        <div className="form-input bg-muted/40 text-sm text-foreground tabular-nums flex items-center min-h-9">
                          {(itemPrixTtc * (1 - itemRemise / 100) * (1 + itemTva / 100)).toFixed(3)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Manual entry — multiline fields + natural Tab / Shift+Tab order */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="manual-item-designation" className="text-xs text-muted-foreground mb-1 block">
                        Nom de l&apos;article *
                      </Label>
                      <Textarea
                        id="manual-item-designation"
                        rows={2}
                        value={itemDesignation}
                        onChange={e => setItemDesignation(e.target.value)}
                        className="form-input min-h-[2.5rem] resize-y"
                        placeholder="Nom de l'article"
                      />
                    </div>
                    <div>
                      <Label htmlFor="manual-item-description" className="text-xs text-muted-foreground mb-1 block">
                        Description (opt.)
                      </Label>
                      <Textarea
                        id="manual-item-description"
                        rows={2}
                        value={itemDescription}
                        onChange={e => setItemDescription(e.target.value)}
                        className="form-input min-h-[2.5rem] resize-y"
                        placeholder="Description"
                      />
                    </div>
                  </div>
                  <div className={`grid gap-3 ${devisType === 'vente' ? (isTtc ? 'grid-cols-6' : 'grid-cols-4') : (isTtc ? 'grid-cols-5' : 'grid-cols-3')}`}>
                    <div>
                      <label htmlFor="manual-item-qty" className="text-xs text-muted-foreground mb-1 block">Quantité</label>
                      <input
                        id="manual-item-qty"
                        type="text"
                        inputMode="numeric"
                        value={itemQuantity}
                        onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="form-input"
                      />
                    </div>
                    {devisType === 'vente' && (
                      <div>
                        <label htmlFor="manual-item-prix-achat" className="text-xs text-muted-foreground mb-1 block">Prix Achat HT</label>
                        <input id="manual-item-prix-achat" type="text" inputMode="decimal" value={formatDecimalFieldValue(itemPrixAchat)} onChange={e => setItemPrixAchat(parseDecimalInput(e.target.value))} className="form-input" />
                      </div>
                    )}
                    <div>
                      <label htmlFor="manual-item-prix-ht" className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat HT' : 'Prix Vente HT'}</label>
                      <input
                        id="manual-item-prix-ht"
                        type="text"
                        inputMode="decimal"
                        value={
                          devisType === 'vente'
                            ? (itemPrixVenteDraft ?? formatDecimalFieldValue(itemPrixTtc))
                            : formatDecimalFieldValue(itemPrixTtc)
                        }
                        onChange={e => {
                          if (devisType === 'vente') {
                            setItemPrixVenteDraft(e.target.value);
                            setItemPrixTtc(parseDecimalInputLoose(e.target.value));
                          } else {
                            setItemPrixTtc(parseDecimalInput(e.target.value));
                          }
                        }}
                        onFocus={
                          devisType === 'vente'
                            ? () =>
                                setItemPrixVenteDraft(
                                  itemPrixTtc === 0 ? '' : formatDecimalFieldValue(itemPrixTtc)
                                )
                            : undefined
                        }
                        onBlur={devisType === 'vente' ? () => setItemPrixVenteDraft(null) : undefined}
                        className="form-input"
                        placeholder={devisType === 'vente' ? 'Saisir le PU vente HT' : undefined}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-item-remise" className="text-xs text-muted-foreground mb-1 block">Remise %</label>
                      <input id="manual-item-remise" type="text" inputMode="decimal" value={itemRemise || ''} onChange={e => setItemRemise(parseDecimalInput(e.target.value))} className="form-input" />
                    </div>
                    {isTtc && (
                      <div>
                        <label htmlFor="manual-item-tva" className="text-xs text-muted-foreground mb-1 block">TVA %</label>
                        <select id="manual-item-tva" value={String(itemTva)} onChange={e => setItemTva(Number(e.target.value))} className="form-input">
                          <option value="7">7%</option>
                          <option value="13">13%</option>
                          <option value="19">19%</option>
                        </select>
                      </div>
                    )}
                    {isTtc && (
                      <div>
                        <span className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat TTC unit.' : 'Prix Vente TTC unit. (après remise)'}</span>
                        <div
                          className="form-input bg-muted/40 text-sm text-foreground tabular-nums flex items-center min-h-9"
                          tabIndex={-1}
                          aria-hidden
                        >
                          {(itemPrixTtc * (1 - itemRemise / 100) * (1 + itemTva / 100)).toFixed(3)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}



              <Button onClick={addItem} disabled={!itemDesignation.trim()} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> {docType === 'bc' ? 'Ajouter au bon de commande' : 'Ajouter au devis'}
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
        <div className="bg-card rounded-xl border border-border p-6 lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-card z-10 pb-2">
            <h3 className="text-lg font-semibold text-foreground">Articles du Devis</h3>
          </div>

          {devisItems.length > 0 && (
            <div className={`grid ${isTtc ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border text-center text-xs`}>
              <div>
                <p className="text-muted-foreground">Total HT</p>
                <p className="font-semibold text-foreground">{devisTotals.totalHT.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Remise</p>
                <p className="font-semibold text-destructive">-{devisTotals.totalRemise.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net HT</p>
                <p className="font-semibold text-foreground">{devisTotals.totalNet.toFixed(3)}</p>
              </div>
              {isTtc && (
                <div>
                  <p className="text-muted-foreground">TVA</p>
                  <p className="font-semibold text-foreground">{devisTotals.totalTVA.toFixed(3)}</p>
                </div>
              )}
              {isTtc && (
                <div>
                  <p className="text-muted-foreground">Total TTC</p>
                  <p className="font-semibold text-foreground">{devisTotals.totalTTC.toFixed(3)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Timbre</p>
                <p className="font-semibold text-foreground">1.000</p>
              </div>
              <div className={`${isTtc ? 'col-span-2 sm:col-span-3' : 'col-span-2'} border-t border-border pt-2 mt-1`}>
                <p className="text-muted-foreground">{isTtc ? 'Total TTC' : 'Total HT'}</p>
                <p className="font-bold text-primary text-sm">{(isTtc ? devisTotals.totalFinal : devisTotals.totalFinalHT).toFixed(3)} TND</p>
              </div>
            </div>
          )}

          {devisItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Aucun article ajouté.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devisItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-muted/50">
                  {editingItemIdx === idx ? (
                    <div className="space-y-3">
                      <div className="grid gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Article / désignation</label>
                          <input type="text" value={editItemDesignation} onChange={e => setEditItemDesignation(e.target.value)} className="form-input" placeholder="Nom de l'article" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Fournisseur</label>
                          <input type="text" value={editItemFournisseur} onChange={e => setEditItemFournisseur(e.target.value)} className="form-input" placeholder="Fournisseur" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                          <input type="text" value={editItemDescription} onChange={e => setEditItemDescription(e.target.value)} className="form-input" placeholder="Description (optionnel)" />
                        </div>
                      </div>
                      <div className={`grid gap-3 ${devisType === 'vente' ? (isTtc ? 'grid-cols-6' : 'grid-cols-4') : (isTtc ? 'grid-cols-5' : 'grid-cols-3')}`}>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Qté</label>
                          <input type="number" min="1" value={editItemQty} onChange={e => setEditItemQty(parseInt(e.target.value) || 1)} className="form-input" />
                        </div>
                        {devisType === 'vente' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Prix Achat HT</label>
                            <input type="text" inputMode="decimal" value={formatDecimalFieldValue(editItemPrixAchat)} onChange={e => setEditItemPrixAchat(parseDecimalInput(e.target.value))} className="form-input" />
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat HT' : 'Prix Vente HT'}</label>
                          <input type="text" inputMode="decimal" value={editItemPrix || ''} onChange={e => setEditItemPrix(parseDecimalInput(e.target.value))} className="form-input" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Remise %</label>
                          <input type="text" inputMode="decimal" value={editItemRemise || ''} onChange={e => setEditItemRemise(parseDecimalInput(e.target.value))} className="form-input" />
                        </div>
                        {isTtc && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">TVA %</label>
                            <select value={String(editItemTva)} onChange={e => setEditItemTva(Number(e.target.value))} className="form-input">
                              <option value="7">7%</option>
                              <option value="13">13%</option>
                              <option value="19">19%</option>
                            </select>
                          </div>
                        )}
                        {isTtc && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">{isAchat ? 'Prix Achat TTC unit.' : 'Prix Vente TTC unit. (après remise)'}</label>
                            <div className="form-input bg-muted/40 text-sm text-foreground tabular-nums flex items-center min-h-9">
                              {(editItemPrix * (1 - editItemRemise / 100) * (1 + editItemTva / 100)).toFixed(3)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={cancelEditItem}><X className="w-3 h-3 mr-1" /> Annuler</Button>
                        <Button size="sm" onClick={saveEditItem}><Check className="w-3 h-3 mr-1" /> Valider</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.designation}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.fournisseur && `${item.fournisseur} • `}
                          Qté: {item.quantity}
                          {item.prix_achat != null && item.prix_achat > 0 && ` • Achat HT: ${item.prix_achat.toFixed(3)}`}
                          {item.prix_achat != null && item.prix_achat > 0 && isTtc && !isAchat && ` (achat TTC indic.: ${(item.prix_achat * (1 + (item.tva ?? 19) / 100)).toFixed(3)})`}
                          {` • ${isAchat ? 'PU achat' : 'PU vente'} HT: ${item.prix_ttc.toFixed(3)}`}
                          {isTtc && ` • TVA: ${item.tva ?? 19}%`}
                          {(() => {
                            const line = computeDevisLine(item, false);
                            const bits: string[] = [];
                            if (item.remise > 0) {
                              bits.push(`remise ${item.remise}% sur PU HT → net HT unit. ${line.unitAfterRemiseHT.toFixed(3)}`);
                            }
                            if (isTtc && !isAchat) {
                              bits.push(`PU TTC unit. ${line.unitAfterRemiseTTC.toFixed(3)}`);
                            }
                            const lineLabel = isTtc ? 'Total ligne TTC' : 'Total ligne HT';
                            const lineVal = isTtc ? line.lineTTC : line.lineHT;
                            bits.push(`${lineLabel}: ${lineVal.toFixed(3)} TND`);
                            return bits.length ? ` • ${bits.join(' • ')}` : '';
                          })()}
                        </p>
                        {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEditItem(idx)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom (Société) *</Label>
              <Input value={newFournisseurName} onChange={e => setNewFournisseurName(e.target.value)} placeholder="Nom du fournisseur" />
            </div>
            <div className="space-y-2">
              <Label>Code fournisseur *</Label>
              <Input value={newFournisseurCode} onChange={e => setNewFournisseurCode(e.target.value)} placeholder="Ex: FRN-001" />
            </div>
            <div className="space-y-2">
              <Label>Matricule Fiscale *</Label>
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
            <PhoneLinesEditor
              idPrefix="devis-fournisseur"
              label="Téléphone(s)"
              required
              lines={newFournisseurPhoneLines}
              onChange={setNewFournisseurPhoneLines}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Gouvernorat *</Label>
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
                <Label>Ville *</Label>
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
            <div className="space-y-3 pt-2 border-t border-dashed">
              <Label className="text-sm font-semibold">Documents (PDF, JPG, PNG) — optionnel</Label>
              {newFournisseurCode.trim() ? (
                <div className="space-y-3">
                  <DocumentUploader
                    bucket="client-documents"
                    entityCode={`FRN_${newFournisseurCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                    documentType="patente"
                    currentUrl={newFournisseurPatenteUrl}
                    onUploadSuccess={(url) => setNewFournisseurPatenteUrl(url)}
                    onRemove={() => setNewFournisseurPatenteUrl(null)}
                    onConsult={(url) => void openDocumentPreview(url, `Patente — ${newFournisseurName.trim() || newFournisseurCode}`)}
                  />
                  <DocumentUploader
                    bucket="client-documents"
                    entityCode={`FRN_${newFournisseurCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                    documentType="rc"
                    titleOverride="RNE (Registre national des entreprises)"
                    currentUrl={newFournisseurRneUrl}
                    onUploadSuccess={(url) => setNewFournisseurRneUrl(url)}
                    onRemove={() => setNewFournisseurRneUrl(null)}
                    onConsult={(url) => void openDocumentPreview(url, `RNE — ${newFournisseurName.trim() || newFournisseurCode}`)}
                  />
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Saisissez le code fournisseur pour activer l&apos;envoi Patente et RNE.</p>
                </div>
              )}
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
              <div className="relative">
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
                {newArticle.image && (
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setNewArticle(p => ({ ...p, image: null })); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
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
              {/* Fiche Technique Upload */}
              <div className="col-span-2 space-y-2">
                <Label>Fiches Techniques</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => newArticleFicheRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" />
                    Ajouter fichier(s)
                  </Button>
                  <input
                    ref={newArticleFicheRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) setNewArticleFicheFiles(prev => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Images & PDF (convertis en JPEG)</span>
                </div>
                {newArticleFicheFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {newArticleFicheFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewArticleFicheFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

            {/* Fiche Technique */}
            <div>
              <Label>Fiches Techniques (PDF/Images — multiple)</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={variantFicheRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setVariantFicheFiles(prev => [...prev, ...Array.from(files)]);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => variantFicheRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {variantFicheFiles.length > 0 ? `${variantFicheFiles.length} fichier(s)` : 'Choisir des fichiers'}
                  </Button>
                  {variantFicheFiles.length > 0 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setVariantFicheFiles([])}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {variantFicheFiles.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {variantFicheFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{f.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setVariantFicheFiles(prev => prev.filter((_, j) => j !== i))}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      <ClientDocumentPreviewDialog preview={documentPreview} pdfBytesRef={pdfBytesRef} onClose={closeDocumentPreview} />
    </>
  );
});

DevisForm.displayName = 'DevisForm';

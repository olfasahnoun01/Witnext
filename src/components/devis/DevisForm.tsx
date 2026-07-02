import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { ProductGroupFournisseur } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';
import { generateNextEntityCode } from '@/lib/entityCode';
import {
  applyPartyTvaPolicyToItems,
  defaultDevisLineTvaForParty,
  defaultDevisPricingModeIsTtc,
  isPartyExonereDeTva,
  type DevisFormCommitOptions,
} from '@/lib/devisTvaPolicy';
import { CLIENT_TVA_STATUS_OPTIONS, clientTvaStatusLabel, type ClientTvaStatus } from '@/config/sectionThemes';
import { Plus, Trash2, Edit, X, Search, Layers, Check, AlertCircle, Upload, ChevronsUpDown, FileText, ShoppingCart, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Devis, DevisItem, Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiFournisseurInput } from '@/components/inventory/MultiFournisseurInput';
import { createVariant } from '@/services/productGroupService';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { buildCompanyStoragePath } from '@/lib/storagePaths';
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
import { CommercialAttachmentField } from '@/components/shared/CommercialAttachmentField';
import type { CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import { ClientDocumentPreviewDialog } from '@/components/shared/ClientDocumentPreviewDialog';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { PhoneLinesEditor } from '@/components/shared/PhoneLinesEditor';
import { formatPhonesDisplay, parsePhoneListFromStorage, serializePhoneList } from '@/lib/phoneList';
import { validateUploadFile } from '@/lib/uploadValidation';
import {
  DevisField,
  DevisFlowBadge,
  DevisFodecToggle,
  DevisDocumentSettingsBar,
  DevisDocumentSettingsGroup,
  DevisPricingToggle,
  DevisSegmentedGrid,
  DevisSegmentedOption,
  DevisZohoFooter,
  DevisZohoSection,
  DevisZohoShell,
  DevisZohoTopBar,
  DevisZohoTotalsPanel,
} from './DevisFormUi';
import { DevisArticlesTable } from './DevisArticlesTable';
import { DevisPartyFieldsTable } from './DevisPartyFieldsTable';
import { ImportDevisIntoBcPanel } from './ImportDevisIntoBcPanel';
import { useAppLayout } from '@/contexts/AppLayoutContext';

const DEFAULT_CATEGORIES = ['Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Non catégorisé'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];
const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Marron', 'Beige'];

function partyPhoneToLines(displayOrRaw: string): string[] {
  const trimmed = displayOrRaw.trim();
  if (!trimmed) return [''];
  if (trimmed.includes(' · ')) {
    const parts = trimmed.split(' · ').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [''];
  }
  const parsed = parsePhoneListFromStorage(trimmed);
  return parsed.length > 0 ? parsed : [trimmed];
}

function parsePartyAddressFields(address: string): {
  exactLocation: string;
  city: string;
  governorate: string;
} {
  const trimmed = address.trim();
  if (!trimmed) return { exactLocation: '', city: '', governorate: '' };

  const parts = trimmed.split(', ').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      exactLocation: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2],
      governorate: parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return { exactLocation: '', city: parts[0], governorate: parts[1] };
  }
  return { exactLocation: parts[0], city: '', governorate: '' };
}

interface Fournisseur {
  id: number;
  nom: string;
  code?: string | null;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  patente_url?: string | null;
  registre_commerce_url?: string | null;
}

interface Client {
  id: number;
  nom: string;
  code?: string | null;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  tva_status?: ClientTvaStatus | string | null;
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
  isFodecEnabled: boolean;
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
  setIsFodecEnabled: (v: boolean) => void;
  draftSavedAt?: string | null;
  onSave: (options?: DevisFormCommitOptions) => void;
  onUpdate: (options?: DevisFormCommitOptions) => void;
  onCancel: () => void;
  docType: 'devis' | 'bc' | 'ba';
  setDocType: (t: 'devis' | 'bc' | 'ba') => void;
  lockDevisType?: boolean;
  forceDocType?: 'devis' | 'bc';
  existingAttachments?: CommercialAttachmentRecord[];
  pendingAttachmentFiles?: File[];
  onPendingAttachmentFilesChange?: (files: File[]) => void;
  onRemoveExistingAttachment?: (index: number) => void;
  /** Devis disponibles pour remplir un BC (liste devis, même type). */
  importableDevis?: Devis[];
  onImportDevis?: (selected: Devis[]) => void;
  onComposerDirtyChange?: (dirty: boolean) => void;
}

export const DevisForm = memo(({
  devisType, devisNumber, devisDate,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone,
  notes, documentStatus, devisItems, editingDevis, isSaving, isTtc, isFodecEnabled,
  setDevisType, setDevisNumber, setDevisDate,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone,
  setNotes, setDocumentStatus, setDevisItems, setIsTtc, setIsFodecEnabled,
  draftSavedAt,
  onSave, onUpdate, onCancel,
  docType, setDocType, lockDevisType, forceDocType,
  existingAttachments = [],
  pendingAttachmentFiles = [],
  onPendingAttachmentFilesChange,
  onRemoveExistingAttachment,
  importableDevis = [],
  onImportDevis,
  onComposerDirtyChange,
}: DevisFormProps) => {
  const { sidebarOpen } = useAppLayout();
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

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientMatricule, setNewClientMatricule] = useState('');
  const [newClientGovernorate, setNewClientGovernorate] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientPhoneLines, setNewClientPhoneLines] = useState<string[]>(['']);
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNatureActivite, setNewClientNatureActivite] = useState('');
  const [newClientExactLocation, setNewClientExactLocation] = useState('');
  const [newClientPatenteUrl, setNewClientPatenteUrl] = useState<string | null>(null);
  const [newClientRcUrl, setNewClientRcUrl] = useState<string | null>(null);
  const [newClientAttestationUrl, setNewClientAttestationUrl] = useState<string | null>(null);
  const [newClientTvaStatus, setNewClientTvaStatus] = useState<ClientTvaStatus>('assujetti');
  const partyTvaPolicyKeyRef = useRef<string | null>(null);
  const skipTvaPolicyOnEditHydrateRef = useRef(false);
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
  const composerSearchRef = useRef<HTMLInputElement>(null);

  // Item form (manual or from selected product)
  const [itemDesignation, setItemDesignation] = useState('');
  const [itemFournisseur, setItemFournisseur] = useState('');
  const [itemPrixTtc, setItemPrixTtc] = useState<number>(0);
  /** Brouillon PU vente HT (devis vente) pour afficher « 12. » sans perdre le point avant blur. */
  const [itemRemise, setItemRemise] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrixAchat, setItemPrixAchat] = useState<number>(0);
  const [itemTva, setItemTva] = useState<number>(0);
  /** FODEC manuel (BC achat) — null = calcul auto 1 % à l'enregistrement. */
  const [itemFodec, setItemFodec] = useState<number | null>(null);

  useEffect(() => {
    if (!onComposerDirtyChange) return;
    const dirty =
      itemDesignation.trim().length > 0 ||
      itemDescription.trim().length > 0 ||
      productSearch.trim().length > 0 ||
      itemQuantity !== 1 ||
      itemPrixTtc > 0 ||
      itemRemise > 0 ||
      itemPrixAchat > 0 ||
      itemFournisseur.trim().length > 0;
    onComposerDirtyChange(dirty);
  }, [
    onComposerDirtyChange,
    itemDesignation,
    itemDescription,
    productSearch,
    itemQuantity,
    itemPrixTtc,
    itemRemise,
    itemPrixAchat,
    itemFournisseur,
  ]);

  useEffect(() => {
    setItemFodec(null);
  }, [itemPrixTtc, itemRemise, itemQuantity]);

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
      const cid = getActiveCompanyId();
      const fournQuery = supabase.from('fournisseurs').select('id, nom, code, matricule_fiscale, location, phone, patente_url, registre_commerce_url, created_at');
      const clientsQuery = supabase.from('clients').select('id, nom, code, matricule_fiscale, location, phone, tva_status, created_at');
      const [fRes, cRes, catSettingsRes, productsCatsRes, groupCatsRes] = await Promise.all([
        (cid ? fournQuery.eq('company_id', cid) : fournQuery).order('created_at', { ascending: false }),
        (cid ? clientsQuery.eq('company_id', cid) : clientsQuery).order('created_at', { ascending: false }),
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
    if (selectedProduct) {
      const label = `${selectedProduct.sku} — ${selectedProduct.name}`.trim();
      if (debouncedSearch.trim() === label) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
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
  }, [debouncedSearch, isAchat, thirdPartyName, selectedProduct]);

  const selectExistingProduct = useCallback((product: Product) => {
    achatPriceRequestRef.current += 1;
    setSelectedProduct(product);
    setItemDesignation(product.name);
    setItemFournisseur(product.fournisseur || '');
    if (isAchat) {
      const priceHt = product.price || 0;
      setItemPrixTtc(priceHt);
      setItemPrixAchat(0);
      setItemRemise(product.remise || 0);
    } else {
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
    setItemDescription('');
    setProductSearch(`${product.sku} — ${product.name}`.trim());
    setSearchResults([]);
  }, [isAchat, loadPrixAchatFromInventoryProduct]);

  const clearCatalogSelection = useCallback(() => {
    achatPriceRequestRef.current += 1;
    setSelectedProduct(null);
    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemRemise(0);
    setItemQuantity(1);
    setItemDescription('');
    setItemPrixAchat(0);
    setItemTva(0);
    setProductSearch('');
    setSearchResults([]);
  }, []);

  useEffect(() => {
    setSelectedThirdPartyId('');
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

  /** Statut TVA du tiers sélectionné — fournisseur : assujetti ; client : fiche clients. */
  const thirdPartyTvaStatus = useMemo((): ClientTvaStatus | null => {
    const trimmed = thirdPartyName.trim();
    if (!trimmed) return null;
    const list = isAchat ? fournisseurs : clients;
    const match =
      (selectedThirdPartyId
        ? list.find((item) => item.id.toString() === selectedThirdPartyId)
        : undefined) ??
      list.find((item) => item.nom.trim().toLowerCase() === trimmed.toLowerCase());
    if (!match) return isAchat ? 'assujetti' : 'assujetti';
    if (isAchat) return 'assujetti';
    return ((match as Client).tva_status as ClientTvaStatus) || 'assujetti';
  }, [isAchat, fournisseurs, clients, thirdPartyName, selectedThirdPartyId]);

  const partyExonereDeTva = isPartyExonereDeTva(thirdPartyTvaStatus);

  const handlePricingModeChange = useCallback(
    (nextTtc: boolean) => {
      if (partyExonereDeTva && nextTtc) return;
      setIsTtc(nextTtc);
    },
    [partyExonereDeTva, setIsTtc]
  );

  useEffect(() => {
    if (!thirdPartyName.trim() || thirdPartyTvaStatus == null) return;

    const policyKey = `${devisType}|${selectedThirdPartyId}|${thirdPartyName.trim().toLowerCase()}|${thirdPartyTvaStatus}`;
    if (partyTvaPolicyKeyRef.current === policyKey) return;

    if (skipTvaPolicyOnEditHydrateRef.current) {
      partyTvaPolicyKeyRef.current = policyKey;
      skipTvaPolicyOnEditHydrateRef.current = false;
      if (isPartyExonereDeTva(thirdPartyTvaStatus)) {
        setDevisItems((prev) => applyPartyTvaPolicyToItems(prev, thirdPartyTvaStatus));
        setIsTtc(false);
      }
      return;
    }

    partyTvaPolicyKeyRef.current = policyKey;

    const defaultTva = defaultDevisLineTvaForParty(thirdPartyTvaStatus);
    setItemTva(defaultTva);
    setDevisItems((prev) => applyPartyTvaPolicyToItems(prev, thirdPartyTvaStatus));
    setIsTtc(defaultDevisPricingModeIsTtc(thirdPartyTvaStatus));
  }, [thirdPartyTvaStatus, thirdPartyName, selectedThirdPartyId, devisType, setDevisItems, setIsTtc, editingDevis]);

  useEffect(() => {
    if (partyExonereDeTva && isTtc) {
      setIsTtc(false);
    }
  }, [partyExonereDeTva, isTtc, setIsTtc]);

  useEffect(() => {
    partyTvaPolicyKeyRef.current = null;
    skipTvaPolicyOnEditHydrateRef.current = Boolean(editingDevis?.id);
  }, [devisType, editingDevis?.id]);

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

  const newClientCities = useMemo(() => {
    return newClientGovernorate
      ? TUNISIA_LOCATIONS.find(r => r.governorate === newClientGovernorate)?.cities || []
      : [];
  }, [newClientGovernorate]);

  const resetNewClientForm = useCallback(() => {
    setNewClientName('');
    setNewClientMatricule('');
    setNewClientGovernorate('');
    setNewClientCity('');
    setNewClientCode('');
    setNewClientPhoneLines(['']);
    setNewClientEmail('');
    setNewClientNatureActivite('');
    setNewClientExactLocation('');
    setNewClientPatenteUrl(null);
    setNewClientRcUrl(null);
    setNewClientAttestationUrl(null);
    setNewClientTvaStatus('assujetti');
  }, []);

  useEffect(() => {
    if (!showNewClient) return;
    const codes = clients.map((c) => c.code).filter(Boolean) as string[];
    setNewClientCode(generateNextEntityCode(codes));
  }, [showNewClient, clients]);

  useEffect(() => {
    if (!showNewFournisseur) return;
    const codes = fournisseurs.map((f) => f.code).filter(Boolean) as string[];
    setNewFournisseurCode(generateNextEntityCode(codes, 'FRN-', 3));
  }, [showNewFournisseur, fournisseurs]);

  const prefillNewClientFromPartyTable = useCallback(() => {
    const { exactLocation, city, governorate } = parsePartyAddressFields(thirdPartyAddress);
    setNewClientName(thirdPartyName.trim());
    setNewClientMatricule(thirdPartyTaxId.trim());
    setNewClientPhoneLines(partyPhoneToLines(thirdPartyPhone));
    setNewClientExactLocation(exactLocation);
    setNewClientGovernorate(governorate);
    setNewClientCity(city);
    if (thirdPartyTvaStatus) {
      setNewClientTvaStatus(thirdPartyTvaStatus);
    }
  }, [
    thirdPartyName,
    thirdPartyTaxId,
    thirdPartyPhone,
    thirdPartyAddress,
    thirdPartyTvaStatus,
  ]);

  const prefillNewFournisseurFromPartyTable = useCallback(() => {
    const { exactLocation, city, governorate } = parsePartyAddressFields(thirdPartyAddress);
    setNewFournisseurName(thirdPartyName.trim());
    setNewFournisseurMatricule(thirdPartyTaxId.trim());
    setNewFournisseurPhoneLines(partyPhoneToLines(thirdPartyPhone));
    setNewFournisseurGovernorate(governorate);
    setNewFournisseurCity(city);
    if (!city && !governorate && exactLocation) {
      const fallback = parsePartyAddressFields(exactLocation);
      if (fallback.city || fallback.governorate) {
        setNewFournisseurCity(fallback.city);
        setNewFournisseurGovernorate(fallback.governorate);
      }
    }
  }, [thirdPartyName, thirdPartyTaxId, thirdPartyPhone, thirdPartyAddress]);

  const openNewClientDialog = useCallback(() => {
    resetNewClientForm();
    prefillNewClientFromPartyTable();
    setShowNewClient(true);
  }, [resetNewClientForm, prefillNewClientFromPartyTable]);

  const openNewFournisseurDialog = useCallback(() => {
    resetNewFournisseurForm();
    prefillNewFournisseurFromPartyTable();
    setShowNewFournisseur(true);
  }, [resetNewFournisseurForm, prefillNewFournisseurFromPartyTable]);

  const createClient = useCallback(async () => {
    if (!newClientName.trim()) { toast.error('Nom requis'); return; }
    if (!newClientMatricule.trim()) { toast.error('Matricule fiscal requis'); return; }
    const phoneStored = serializePhoneList(newClientPhoneLines);
    if (!phoneStored) { toast.error('Au moins un numéro de téléphone est requis'); return; }
    if (!newClientCode.trim()) { toast.error('Code client requis'); return; }
    if (!newClientGovernorate || !newClientCity) {
      toast.error('Gouvernorat et ville requis');
      return;
    }

    const locationParts = [newClientExactLocation.trim(), newClientCity, newClientGovernorate].filter(Boolean);
    const locationValue = locationParts.length > 0 ? locationParts.join(', ') : null;
    const companyId = getActiveCompanyId();
    if (!companyId) {
      toast.error('Aucune société active');
      return;
    }

    const { data, error } = await supabase.from('clients').insert({
      nom: newClientName.trim(),
      code: newClientCode.trim(),
      matricule_fiscale: newClientMatricule.trim(),
      tva_status: newClientTvaStatus,
      company_id: companyId,
      phone: phoneStored,
      email: newClientEmail.trim() || null,
      nature_activite: newClientNatureActivite.trim() || null,
      location: locationValue,
      patente_url: newClientPatenteUrl,
      registre_commerce_url: newClientRcUrl,
      attestation_exoneration_url: newClientAttestationUrl,
    }).select().single();

    if (error) {
      toast.error('Erreur création client');
      console.error(error);
    } else if (data) {
      toast.success('Client créé');
      setClients((prev) => [data as Client, ...prev]);
      setThirdPartyName(data.nom);
      setThirdPartyPhone(formatPhonesDisplay((data as Client).phone) || '');
      setThirdPartyAddress((data as Client).location || '');
      setThirdPartyTaxId((data as Client).matricule_fiscale || '');
      setSelectedThirdPartyId(data.id.toString());
      partyTvaPolicyKeyRef.current = null;
      setShowNewClient(false);
      resetNewClientForm();
    }
  }, [
    newClientName,
    newClientMatricule,
    newClientCode,
    newClientGovernorate,
    newClientCity,
    newClientPhoneLines,
    newClientEmail,
    newClientNatureActivite,
    newClientExactLocation,
    newClientPatenteUrl,
    newClientRcUrl,
    newClientAttestationUrl,
    newClientTvaStatus,
    setThirdPartyName,
    setThirdPartyPhone,
    setThirdPartyAddress,
    setThirdPartyTaxId,
    resetNewClientForm,
  ]);

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
      company_id: getActiveCompanyId() || undefined,
      phone: phoneStored,
      location: locationValue,
      patente_url: newFournisseurPatenteUrl,
      registre_commerce_url: newFournisseurRneUrl,
    }).select().single();
    if (error) {
      toast.error('Erreur création fournisseur');
    } else if (data) {
      toast.success('Fournisseur créé');
      setFournisseurs((prev) => [data as Fournisseur, ...prev]);
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

  const buildCommitOptions = useCallback((): DevisFormCommitOptions | undefined => {
    if (isAchat || !thirdPartyTvaStatus) return undefined;
    return {
      items: applyPartyTvaPolicyToItems(devisItems, thirdPartyTvaStatus),
      isTtc: isPartyExonereDeTva(thirdPartyTvaStatus) ? false : isTtc,
      partyTvaStatus: thirdPartyTvaStatus,
    };
  }, [isAchat, thirdPartyTvaStatus, devisItems, isTtc]);

  const handleSave = useCallback(() => {
    const commit = buildCommitOptions();
    if (commit) {
      setDevisItems(commit.items);
      setIsTtc(commit.isTtc);
    }
    onSave(commit);
  }, [buildCommitOptions, onSave, setDevisItems, setIsTtc]);

  const handleUpdate = useCallback(() => {
    onUpdate(buildCommitOptions());
  }, [buildCommitOptions, onUpdate]);

  const addItem = useCallback(() => {
    if (articleMode === 'search') {
      if (!selectedProduct) {
        toast.error('Sélectionnez un article dans le catalogue');
        return;
      }
    } else if (!itemDesignation.trim()) {
      toast.error('Nom d\'article requis');
      return;
    }
    if (devisType === 'vente' && itemPrixTtc <= 0) {
      toast.error('Indiquez le prix de vente HT');
      return;
    }

    const detailDescription = itemDescription.trim();
    const catalogSku = selectedProduct?.sku?.trim();
    const showFodecColumn = isAchat && isFodecEnabled && !partyExonereDeTva;
    const fodecExtra =
      showFodecColumn && itemFodec !== null ? { fodec: itemFodec } : {};

    const newItems: DevisItem[] =
      articleMode === 'search' && selectedProduct
        ? [
            {
              line_id: Math.random().toString(36).substring(7),
              designation: selectedProduct.name,
              fournisseur: selectedProduct.fournisseur?.trim() || itemFournisseur.trim(),
              prix_ttc: itemPrixTtc,
              remise: itemRemise,
              quantity: itemQuantity,
              description: detailDescription || undefined,
              tva: itemTva,
              ...(catalogSku ? { sku: catalogSku } : {}),
              product_id: selectedProduct.id,
              ...(devisType === 'vente' ? { prix_achat: itemPrixAchat } : {}),
              ...fodecExtra,
            },
          ]
        : itemDesignation
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d !== '')
            .map((name) => ({
              line_id: Math.random().toString(36).substring(7),
              designation: name,
              fournisseur:
                articleMode === 'manual' && isAchat
                  ? thirdPartyName.trim()
                  : itemFournisseur.trim(),
              prix_ttc: itemPrixTtc,
              remise: itemRemise,
              quantity: itemQuantity,
              description: detailDescription || undefined,
              tva: itemTva,
              ...(devisType === 'vente' ? { prix_achat: itemPrixAchat } : {}),
              ...fodecExtra,
            }));

    setDevisItems(prev => [...prev, ...newItems]);

    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemRemise(0);
    setItemQuantity(1);
    setItemDescription('');
    setItemPrixAchat(0);
    setItemTva(0);
    setItemFodec(null);
    setProductSearch('');
    setSearchResults([]);
    setSelectedProduct(null);
    achatPriceRequestRef.current += 1;
    if (articleMode === 'search') {
      requestAnimationFrame(() => composerSearchRef.current?.focus());
    }
  }, [itemDesignation, itemFournisseur, itemPrixTtc, itemRemise, itemQuantity, itemDescription, itemPrixAchat, itemTva, itemFodec, isAchat, isFodecEnabled, partyExonereDeTva, articleMode, thirdPartyName, selectedProduct, setDevisItems]);



  const removeItem = useCallback((idx: number) => {
    setDevisItems(prev => prev.filter((_, i) => i !== idx));
  }, [setDevisItems]);

  const updateLineItem = useCallback(
    (idx: number, patch: Partial<DevisItem>) => {
      setDevisItems((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
      );
    },
    [setDevisItems]
  );

  const handleSaveDraft = useCallback(() => {
    setDocumentStatus('brouillon');
    requestAnimationFrame(() => handleSave());
  }, [setDocumentStatus, handleSave]);

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
      const articleCompanyId = getActiveCompanyId();
      const existingFournQuery = supabase.from('fournisseurs').select('nom');
      const { data: existingFourns } = await (articleCompanyId ? existingFournQuery.eq('company_id', articleCompanyId) : existingFournQuery);
      const existingNames = new Set((existingFourns || []).map(f => f.nom.toLowerCase()));

      const newFournisseurEntries = newArticleFournisseurs
        .filter(f => f.fournisseur_name.trim() && !existingNames.has(f.fournisseur_name.trim().toLowerCase()));

      if (newFournisseurEntries.length > 0) {
        await supabase.from('fournisseurs').insert(
          newFournisseurEntries.map(f => ({
            nom: f.fournisseur_name.trim(),
            specialite: newArticle.category || 'Non catégorisé',
            company_id: articleCompanyId || undefined,
            phone: f.phone?.trim() || null,
          })) as any
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
        company_id: articleCompanyId || undefined,
      } as any).select().single();

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

      const { data, error } = await supabase
        .from('products')
        .insert(productsToInsert.map((p) => ({ ...p, company_id: articleCompanyId || undefined })) as any)
        .select();

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
                const filePath = buildCompanyStoragePath(`fiches/${fileName}`);
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
        const catalogDetail = (d: { size?: string; color?: string | null }) => {
          const parts = [
            d.size ? `Taille: ${d.size}` : '',
            d.color ? `Couleur: ${d.color}` : '',
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(' · ') : undefined;
        };

        if (data.length > 1) {
          const newItems = data.map(d => ({
            line_id: Math.random().toString(36).substring(7),
            designation: d.name,
            fournisseur: d.fournisseur || '',
            prix_ttc: devisType === 'vente' ? 0 : (d.price || 0),
            remise: devisType === 'vente' ? 0 : (d.remise || 0),
            quantity: 1,
            description: catalogDetail(d),
            sku: d.sku?.trim() || undefined,
            product_id: d.id,
          }));
          setDevisItems(prev => [...prev, ...newItems]);
          setItemDesignation('');
          setItemFournisseur('');
          setItemPrixTtc(0);
          setItemQuantity(1);
          setItemDescription('');
          setSelectedProduct(null);
        } else {
          setItemDesignation(first.name);
          setItemFournisseur(first.fournisseur || '');
          setItemQuantity(1);
          setItemDescription(catalogDetail(first) || '');
          setSelectedProduct(first as Product);
          if (devisType === 'vente') {
            setItemPrixTtc(0);
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
                const filePath = buildCompanyStoragePath(`fiches/${fileName}`);
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
          setItemDescription('');
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

  // Lignes devis: prix unitaire HT ; TVA appliquée uniquement si l'utilisateur choisit un taux > 0 %
  const devisTotals = useMemo(() => {
    return computeDevisTotals(devisItems, false, {
      devisType,
      docType,
      isTvaEnabled: isTtc && !partyExonereDeTva,
      isFodecEnabled,
    });
  }, [devisItems, devisType, docType, isTtc, isFodecEnabled, partyExonereDeTva]);
  const totalAmount = devisTotals.totalFinal;
  const thirdPartyLabel = isAchat ? 'Fournisseur' : 'Client';

  const savePrimaryLabel =
    docType === 'bc' ? 'Enregistrer le bon de commande' : 'Enregistrer le devis';

  const canCommitComposerLine =
    articleMode === 'search'
      ? Boolean(selectedProduct) && (devisType !== 'vente' || itemPrixTtc > 0)
      : Boolean(itemDesignation.trim()) && (devisType !== 'vente' || itemPrixTtc > 0);

  return (
    <>
      <DevisZohoShell
        className={cn(
          'w-full',
          sidebarOpen ? 'max-w-6xl mx-auto' : 'max-w-none'
        )}
      >
        <DevisZohoTopBar>
          <DevisDocumentSettingsBar>
            <div className="flex flex-wrap items-end gap-4 min-w-0">
              <DevisDocumentSettingsGroup label="Nature">
                {!editingDevis && !forceDocType ? (
                  <DevisSegmentedGrid>
                    <DevisSegmentedOption
                      value="devis"
                      current={docType}
                      onSelect={setDocType}
                      accent={isAchat ? 'achat' : 'vente'}
                      label="Devis"
                      icon={FileText}
                      className="min-h-[2.5rem] py-1.5"
                    />
                    <DevisSegmentedOption
                      value="bc"
                      current={docType}
                      onSelect={setDocType}
                      accent={isAchat ? 'achat' : 'vente'}
                      label="BC"
                      icon={ShoppingCart}
                      className="min-h-[2.5rem] py-1.5"
                    />
                  </DevisSegmentedGrid>
                ) : (
                  <DevisFlowBadge devisType={devisType} docType={docType} />
                )}
              </DevisDocumentSettingsGroup>

              <DevisDocumentSettingsGroup label="Flux">
                {!forceDocType && !lockDevisType ? (
                  <DevisSegmentedGrid>
                    <DevisSegmentedOption
                      value="achat"
                      current={devisType}
                      onSelect={setDevisType}
                      accent="achat"
                      label="Achat"
                      icon={ArrowDownLeft}
                      className="min-h-[2.5rem] py-1.5"
                    />
                    <DevisSegmentedOption
                      value="vente"
                      current={devisType}
                      onSelect={setDevisType}
                      accent="vente"
                      label="Vente"
                      icon={ArrowUpRight}
                      className="min-h-[2.5rem] py-1.5"
                    />
                  </DevisSegmentedGrid>
                ) : (
                  <DevisFlowBadge devisType={devisType} docType={docType} />
                )}
              </DevisDocumentSettingsGroup>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {partyExonereDeTva ? (
                <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground max-w-xs">
                  Prix <span className="font-medium text-foreground">HT</span>
                  {thirdPartyTvaStatus ? (
                    <> — {clientTvaStatusLabel(thirdPartyTvaStatus)}</>
                  ) : null}
                  . Aucune TVA sur ce document.
                </div>
              ) : (
                <DevisPricingToggle
                  isTtc={isTtc}
                  onChange={handlePricingModeChange}
                  compact
                />
              )}
              {isAchat && !partyExonereDeTva && (
                <DevisFodecToggle
                  enabled={isFodecEnabled}
                  onChange={setIsFodecEnabled}
                  compact
                />
              )}
              {draftSavedAt && !editingDevis && (
                <p className="text-[11px] text-muted-foreground px-1 tabular-nums">
                  Brouillon local ·{' '}
                  {new Date(draftSavedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </DevisDocumentSettingsBar>
        </DevisZohoTopBar>

        <div className="px-4 sm:px-6 py-5 border-b border-border/50">
          <DevisPartyFieldsTable
            partyLabel={thirdPartyLabel}
            thirdPartyName={thirdPartyName}
            onThirdPartyNameChange={handleThirdPartyNameChange}
            suggestions={filteredThirdParties}
            onSuggestionSelect={handleThirdPartySuggestionSelect}
            devisNumber={devisNumber}
            onDevisNumberChange={setDevisNumber}
            devisDate={devisDate}
            onDevisDateChange={setDevisDate}
            thirdPartyPhone={thirdPartyPhone}
            onThirdPartyPhoneChange={setThirdPartyPhone}
            thirdPartyTaxId={thirdPartyTaxId}
            onThirdPartyTaxIdChange={setThirdPartyTaxId}
            thirdPartyAddress={thirdPartyAddress}
            onThirdPartyAddressChange={setThirdPartyAddress}
            docType={docType}
            documentStatus={documentStatus}
            onDocumentStatusChange={(v) => setDocumentStatus(v)}
            showNewParty
            onNewParty={() => (isAchat ? openNewFournisseurDialog() : openNewClientDialog())}
            newPartyTitle={isAchat ? 'Nouveau fournisseur' : 'Nouveau client'}
          />
        </div>

        {(docType === 'bc' || forceDocType === 'bc') && !editingDevis && onImportDevis && (
          <div className="px-4 sm:px-6 pt-4 border-b border-border/50">
            <ImportDevisIntoBcPanel
              devisList={importableDevis}
              onImport={onImportDevis}
              disabled={isSaving}
            />
          </div>
        )}

        <DevisZohoSection
          title="Tableau d'articles"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <DevisSegmentedGrid cols={2}>
                <DevisSegmentedOption
                  value="search"
                  current={articleMode}
                  accent={isAchat ? 'achat' : 'vente'}
                  onSelect={(v) => {
                    achatPriceRequestRef.current += 1;
                    const keepName = itemDesignation.trim() || productSearch.trim();
                    setArticleMode(v);
                    setSelectedProduct(null);
                    if (keepName) {
                      setItemDesignation(keepName);
                      if (v === 'search') setProductSearch(keepName);
                    }
                    setItemFournisseur('');
                    setItemPrixTtc(0);
                    setItemDescription('');
                    if (!keepName) {
                      setProductSearch('');
                      setSearchResults([]);
                    }
                  }}
                  label="Catalogue"
                  icon={Search}
                  className="min-h-[2.25rem] py-2"
                />
                <DevisSegmentedOption
                  value="manual"
                  current={articleMode}
                  accent={isAchat ? 'achat' : 'vente'}
                  onSelect={(v) => {
                    achatPriceRequestRef.current += 1;
                    const keepName = itemDesignation.trim() || productSearch.trim();
                    setArticleMode(v);
                    setSelectedProduct(null);
                    if (keepName) {
                      setItemDesignation(keepName);
                      if (v === 'search') setProductSearch(keepName);
                    }
                    setItemFournisseur('');
                    setItemPrixTtc(0);
                    setItemDescription('');
                    if (!keepName) {
                      setProductSearch('');
                      setSearchResults([]);
                    }
                  }}
                  label="Saisie libre"
                  icon={Edit}
                  className="min-h-[2.25rem] py-2"
                />
              </DevisSegmentedGrid>
              <Button variant="outline" size="sm" onClick={() => setShowAddVariant(true)} className="h-8 text-xs">
                <Layers className="w-3.5 h-3.5 mr-1" />
                Variante
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewArticle(true)} className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nouvel article
              </Button>
            </div>
          }
        >
          <DevisArticlesTable
            items={devisItems}
            isTtc={isTtc}
            devisType={devisType}
            articleMode={articleMode}
            composerSearchRef={composerSearchRef}
            onUpdate={updateLineItem}
            onRemove={removeItem}
            onCommitLine={addItem}
            canCommitLine={canCommitComposerLine}
            productSearch={productSearch}
            onProductSearchChange={setProductSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            selectedProduct={selectedProduct}
            onSelectProduct={selectExistingProduct}
            onClearProduct={clearCatalogSelection}
            itemDesignation={itemDesignation}
            onItemDesignationChange={setItemDesignation}
            itemDescription={itemDescription}
            onItemDescriptionChange={setItemDescription}
            itemQuantity={itemQuantity}
            onItemQuantityChange={setItemQuantity}
            itemPrixAchat={itemPrixAchat}
            onItemPrixAchatChange={setItemPrixAchat}
            itemPrixTtc={itemPrixTtc}
            onItemPrixTtcChange={setItemPrixTtc}
            itemRemise={itemRemise}
            onItemRemiseChange={setItemRemise}
            itemTva={itemTva}
            onItemTvaChange={setItemTva}
            itemFodec={itemFodec}
            onItemFodecChange={setItemFodec}
            partyExonereDeTva={partyExonereDeTva}
            showFodecColumn={isAchat && isFodecEnabled && !partyExonereDeTva}
          />
        </DevisZohoSection>

        <div className="px-4 sm:px-6 py-5 border-t border-border/60 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4 min-w-0">
            <DevisField label="Notes / conditions">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input min-h-[80px] resize-y w-full"
                placeholder="Conditions de paiement, délais, remarques…"
              />
            </DevisField>
            {(docType === 'bc' || docType === 'devis') && onPendingAttachmentFilesChange && (
              <CommercialAttachmentField
                label={docType === 'bc' ? 'Bon de commande scanné / pièces jointes' : 'Pièces jointes'}
                hint={
                  docType === 'bc'
                    ? 'Optionnel — importez un BC déjà signé (PDF, photo…) ou tout fichier.'
                    : 'Optionnel — PDF, images ou tout fichier.'
                }
                existing={existingAttachments}
                pendingFiles={pendingAttachmentFiles}
                onPendingChange={onPendingAttachmentFilesChange}
                onRemoveExisting={onRemoveExistingAttachment}
                disabled={isSaving}
              />
            )}
          </div>
          <DevisZohoTotalsPanel totals={devisTotals} showTva={isTtc && !partyExonereDeTva} />
        </div>

        <DevisZohoFooter
          editing={Boolean(editingDevis)}
          isSaving={isSaving}
          onCancel={onCancel}
          onSave={handleSave}
          onUpdate={handleUpdate}
          onSaveDraft={!editingDevis ? handleSaveDraft : undefined}
          saveLabel={savePrimaryLabel}
          draftSavedAt={draftSavedAt}
        />
      </DevisZohoShell>

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

      {/* New Client Dialog */}
      <Dialog open={showNewClient} onOpenChange={(open) => {
        setShowNewClient(open);
        if (!open) resetNewClientForm();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom (Société) *</Label>
              <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nom du client" />
            </div>
            <div className="space-y-2">
              <Label>Nature d'activité</Label>
              <Input value={newClientNatureActivite} onChange={e => setNewClientNatureActivite(e.target.value)} placeholder="Ex: Import/Export, BTP..." />
            </div>
            <div className="space-y-2">
              <Label>Code client *</Label>
              <Input value={newClientCode} onChange={e => setNewClientCode(e.target.value)} placeholder="Ex: CLI-001" />
            </div>
            <div className="space-y-2">
              <Label>Matricule Fiscale *</Label>
              <Input value={newClientMatricule} onChange={e => setNewClientMatricule(e.target.value)} placeholder="Ex: 1234567/A/B/C/000" />
            </div>
            <div className="space-y-2">
              <Label>Statut TVA *</Label>
              <Select
                value={newClientTvaStatus}
                onValueChange={(v) => setNewClientTvaStatus(v as ClientTvaStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Statut TVA" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TVA_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PhoneLinesEditor
              idPrefix="devis-client"
              label="Téléphone(s)"
              required
              lines={newClientPhoneLines}
              onChange={setNewClientPhoneLines}
            />
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="Ex: contact@societe.tn" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Gouvernorat *</Label>
                <Select value={newClientGovernorate} onValueChange={val => { setNewClientGovernorate(val); setNewClientCity(''); }}>
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
                <Select value={newClientCity} onValueChange={setNewClientCity} disabled={!newClientGovernorate}>
                  <SelectTrigger>
                    <SelectValue placeholder={newClientGovernorate ? 'Ville' : 'Choisir région'} />
                  </SelectTrigger>
                  <SelectContent>
                    {newClientCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse Exacte *</Label>
              <Input value={newClientExactLocation} onChange={e => setNewClientExactLocation(e.target.value)} placeholder="Ex: Rue Ibn Khaldoun..." />
            </div>
            <div className="space-y-3 pt-2 border-t border-dashed">
              <Label className="text-sm font-semibold">Documents (PDF, JPG, PNG) — optionnel</Label>
              {newClientCode.trim() ? (
                <div className="space-y-3">
                  <DocumentUploader
                    bucket="client-documents"
                    entityCode={`CLI_${newClientCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                    documentType="patente"
                    currentUrl={newClientPatenteUrl}
                    onUploadSuccess={(url) => setNewClientPatenteUrl(url)}
                    onRemove={() => setNewClientPatenteUrl(null)}
                    onConsult={(url) => void openDocumentPreview(url, `Patente — ${newClientName.trim() || newClientCode}`)}
                  />
                  <DocumentUploader
                    bucket="client-documents"
                    entityCode={`CLI_${newClientCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                    documentType="rc"
                    titleOverride="RNE (Registre national des entreprises)"
                    currentUrl={newClientRcUrl}
                    onUploadSuccess={(url) => setNewClientRcUrl(url)}
                    onRemove={() => setNewClientRcUrl(null)}
                    onConsult={(url) => void openDocumentPreview(url, `RNE — ${newClientName.trim() || newClientCode}`)}
                  />
                  {newClientTvaStatus === 'exonere' && (
                    <DocumentUploader
                      bucket="client-documents"
                      entityCode={`CLI_${newClientCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                      documentType="attestation_exoneration"
                      titleOverride="Attestation d'exonération"
                      currentUrl={newClientAttestationUrl}
                      onUploadSuccess={(url) => setNewClientAttestationUrl(url)}
                      onRemove={() => setNewClientAttestationUrl(null)}
                      onConsult={(url) => void openDocumentPreview(url, `Attestation exonération — ${newClientName.trim() || newClientCode}`)}
                    />
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Saisissez le code client pour activer l&apos;envoi Patente et RNE.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewClient(false); resetNewClientForm(); }}>Annuler</Button>
            <Button onClick={() => void createClient()}>Ajouter</Button>
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

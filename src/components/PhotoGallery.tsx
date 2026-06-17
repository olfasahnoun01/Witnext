import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchInventoryCategoryNames } from '@/lib/inventoryCategoryNames';
import { buildCompanyStoragePath } from '@/lib/storagePaths';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { filterDecimalDraft, parseDecimalInput } from '@/lib/numberInput';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Edit,
  FolderOpen,
  Tag,
  Check,
  ChevronsUpDown,
  FileText,
  Copy,
  ExternalLink,
  Download,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const ITEMS_PER_PAGE = 20;

/** WooCommerce import pulls full catalog + images — disabled to limit Storage egress. Set true to re-enable. */
const GALLERY_WOOCOMMERCE_IMPORT_ENABLED = false;

const GALLERY_ITEM_COLUMNS =
  'id, name, category, description, photos, fiches_techniques, devis_fichiers, prix_vente_ttc, prix_achat_ttc, created_at';

function parseUrlArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) return p.filter((u): u is string => typeof u === 'string' && u.length > 0);
    } catch {
      return raw.trim() ? [raw] : [];
    }
    return [];
  }
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string' && u.length > 0);
  return [];
}

function formatTnd(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND TTC`;
}

interface GalleryItem {
  id: number;
  name: string;
  category: string;
  description: string | null;
  photos: string[];
  fiches_techniques: string[];
  devis_fichiers: string[];
  prix_vente_ttc: number | null;
  prix_achat_ttc: number | null;
  created_at: string;
}

interface GalleryCategory {
  id: number;
  name: string;
}

export const PhotoGallery = () => {
  const { toast } = useToast();
  const canEdit = true;

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [dbCategories, setDbCategories] = useState<GalleryCategory[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Category CRUD states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<GalleryCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  /** Vue rapide : photos, prix, fiches (réponses clients / réseaux sociaux) */
  const [quickViewItem, setQuickViewItem] = useState<GalleryItem | null>(null);
  const [quickViewPhotoIndex, setQuickViewPhotoIndex] = useState(0);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrixTtc, setFormPrixTtc] = useState('');
  const [formPrixAchat, setFormPrixAchat] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formFiches, setFormFiches] = useState<string[]>([]);
  const [formDevis, setFormDevis] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFiche, setUploadingFiche] = useState(false);
  const [uploadingDevis, setUploadingDevis] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importingFromSite, setImportingFromSite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ficheInputRef = useRef<HTMLInputElement>(null);
  const devisInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('gallery_categories')
      .select('id, name')
      .order('name');
    if (data) setDbCategories(data);
  }, []);

  const fetchInventoryCategories = useCallback(async () => {
    try {
      const names = await fetchInventoryCategoryNames();
      setInventoryCategories(names);
    } catch {
      setInventoryCategories([]);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('gallery_items')
      .select(GALLERY_ITEM_COLUMNS)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(
        data.map(d => ({
          ...d,
          photos: parseUrlArray(d.photos),
          fiches_techniques: parseUrlArray((d as { fiches_techniques?: unknown }).fiches_techniques),
          devis_fichiers: parseUrlArray((d as { devis_fichiers?: unknown }).devis_fichiers),
          prix_vente_ttc:
            (d as { prix_vente_ttc?: number | string | null }).prix_vente_ttc != null
              ? Number((d as { prix_vente_ttc?: number | string | null }).prix_vente_ttc)
              : null,
          prix_achat_ttc:
            (d as { prix_achat_ttc?: number | string | null }).prix_achat_ttc != null
              ? Number((d as { prix_achat_ttc?: number | string | null }).prix_achat_ttc)
              : null,
          description: d.description || null,
        }))
      );
    }
    setLoading(false);
  }, []);

  const handleRefreshGallery = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchItems(), fetchCategories(), fetchInventoryCategories()]);
      toast({ title: 'Galerie actualisée' });
    } finally {
      setRefreshing(false);
    }
  }, [fetchItems, fetchCategories, fetchInventoryCategories, toast]);

  // Load once on mount — no realtime (avoids refetch loops and repeated Storage image loads).
  useEffect(() => {
    void fetchItems();
    void fetchCategories();
    void fetchInventoryCategories();
  }, [fetchItems, fetchCategories, fetchInventoryCategories]);

  /** Liste déroulante formulaire / filtres : catégories inventaire + galerie (sans « Général »). */
  const categoryChoices = useMemo(() => {
    const s = new Set<string>();
    inventoryCategories.forEach(c => {
      if (c && c !== 'Général') s.add(c);
    });
    dbCategories.forEach(c => {
      if (c.name && c.name !== 'Général') s.add(c.name);
    });
    return [...s].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [inventoryCategories, dbCategories]);

  /** Inclut la valeur courante du formulaire si elle n’est pas dans la liste (édition / saisie libre). */
  const choicesForForm = useMemo(() => {
    const s = new Set(categoryChoices);
    if (formCategory && formCategory !== 'Général') s.add(formCategory);
    return [...s].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [categoryChoices, formCategory]);

  const filtered = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const prixStr =
      item.prix_vente_ttc != null && Number.isFinite(item.prix_vente_ttc)
        ? String(item.prix_vente_ttc)
        : '';
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      prixStr.includes(q.replace(',', '.'));
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory]);

  const resetForm = () => {
    setFormName('');
    setFormCategory('');
    setFormDescription('');
    setFormPrixTtc('');
    setFormPrixAchat('');
    setFormPhotos([]);
    setFormFiches([]);
    setFormDevis([]);
  };

  // Category CRUD
  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (name === 'Général') {
      toast({
        variant: 'destructive',
        title: 'Catégorie non autorisée',
        description: '« Général » n’est plus utilisée dans la galerie. Choisissez une catégorie inventaire ou un autre nom.',
      });
      return;
    }
    const { error } = await supabase.from('gallery_categories').insert({ name });
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      setNewCategoryName('');
      toast({ title: 'Catégorie ajoutée' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    const newName = editCategoryName.trim();
    if (newName === 'Général') {
      toast({
        variant: 'destructive',
        title: 'Non autorisé',
        description: '« Général » n’est plus utilisée dans la galerie.',
      });
      return;
    }
    const oldName = editingCategory.name;
    
    const { error } = await supabase.from('gallery_categories').update({ name: newName }).eq('id', editingCategory.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      return;
    }

    // Update all gallery items with the old category name
    if (oldName !== newName) {
      await supabase.from('gallery_items').update({ category: newName }).eq('category', oldName);
    }

    setEditingCategory(null);
    toast({ title: 'Catégorie modifiée' });
  };

  const handleDeleteCategory = async (cat: GalleryCategory) => {
    const count = items.filter(i => i.category === cat.name).length;
    if (count > 0) {
      toast({ variant: 'destructive', title: 'Impossible', description: `${count} élément(s) utilisent cette catégorie` });
      return;
    }
    if (!confirm(`Supprimer la catégorie "${cat.name}" ?`)) return;
    const { error } = await supabase.from('gallery_categories').delete().eq('id', cat.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Catégorie supprimée' });
    }
  };

  const openAdd = () => {
    resetForm();
    const fromFilter =
      filterCategory !== 'all' && filterCategory !== 'Général' && categoryChoices.includes(filterCategory)
        ? filterCategory
        : categoryChoices[0] ?? '';
    setFormCategory(fromFilter);
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEdit = (item: GalleryItem) => {
    setFormName(item.name);
    setFormCategory(
      item.category === 'Général' ? (categoryChoices[0] ?? '') : item.category
    );
    setFormDescription(item.description || '');
    setFormPrixTtc(
      item.prix_vente_ttc != null && Number.isFinite(item.prix_vente_ttc) ? String(item.prix_vente_ttc) : ''
    );
    setFormPrixAchat(
      item.prix_achat_ttc != null && Number.isFinite(item.prix_achat_ttc) ? String(item.prix_achat_ttc) : ''
    );
    setFormPhotos([...item.photos]);
    setFormFiches([...item.fiches_techniques]);
    setFormDevis([...item.devis_fichiers]);
    setEditingItem(item);
    setShowAddModal(true);
  };

  const openQuickView = (item: GalleryItem) => {
    setQuickViewItem(item);
    setQuickViewPhotoIndex(0);
  };

  const parsePrixInput = (raw: string): number | null => {
    const v = raw.trim();
    if (!v) return null;
    const n = parseDecimalInput(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const handleFicheUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    setUploadingFiche(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: `${file.name} : max 10 Mo` });
        continue;
      }
      if (!allowed.includes(file.type)) {
        toast({ variant: 'destructive', title: 'Format refusé', description: `${file.name} : PDF, JPG, PNG ou WebP uniquement` });
        continue;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = buildCompanyStoragePath(`gallery/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
      const { error } = await supabase.storage.from('fiches-techniques').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      } else {
        toast({ variant: 'destructive', title: 'Upload fiche', description: error.message });
      }
    }
    setFormFiches(prev => [...prev, ...newUrls]);
    setUploadingFiche(false);
    if (ficheInputRef.current) ficheInputRef.current.value = '';
  };

  const removeFiche = (index: number) => {
    setFormFiches(prev => prev.filter((_, i) => i !== index));
  };

  const handleDevisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    setUploadingDevis(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: `${file.name} : max 10 Mo` });
        continue;
      }
      if (!allowed.includes(file.type)) {
        toast({ variant: 'destructive', title: 'Format refusé', description: `${file.name} : PDF, JPG, PNG ou WebP uniquement` });
        continue;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = buildCompanyStoragePath(`gallery/devis/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
      const { error } = await supabase.storage.from('fiches-techniques').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      } else {
        toast({ variant: 'destructive', title: 'Upload devis', description: error.message });
      }
    }
    setFormDevis(prev => [...prev, ...newUrls]);
    setUploadingDevis(false);
    if (devisInputRef.current) devisInputRef.current.value = '';
  };

  const removeDevis = (index: number) => {
    setFormDevis(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: `${file.name} : max 10 Mo` });
        continue;
      }
      const ext = file.name.split('.').pop();
      const path = buildCompanyStoragePath(`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

      const { error } = await supabase.storage
        .from('gallery-photos')
        .upload(path, file, { upsert: true });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('gallery-photos')
          .getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
    }

    setFormPhotos(prev => [...prev, ...newUrls]);
    setUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setFormPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom est obligatoire' });
      return;
    }
    const catTrim = formCategory.trim();
    if (!catTrim || catTrim === 'Général') {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Choisissez une catégorie (liste alignée sur l’inventaire).',
      });
      return;
    }

    setSaving(true);
    const prixParsed = parsePrixInput(formPrixTtc);
    const prixAchatParsed = parsePrixInput(formPrixAchat);
    const payload = {
      name: formName.trim(),
      category: catTrim,
      description: formDescription.trim() || null,
      photos: formPhotos,
      fiches_techniques: formFiches,
      devis_fichiers: formDevis,
      prix_vente_ttc: prixParsed,
      prix_achat_ttc: prixAchatParsed,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('gallery_items')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Modifié', description: 'Élément mis à jour' });
        setShowAddModal(false);
      }
    } else {
      const { error } = await supabase
        .from('gallery_items')
        .insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });

      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Ajouté', description: 'Élément ajouté à la galerie' });
        setShowAddModal(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (item: GalleryItem) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    const { error } = await supabase.from('gallery_items').delete().eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Supprimé', description: 'Élément supprimé' });
    }
  };

  const handleImportFromWebsite = async () => {
    if (
      !confirm(
        'Importer depuis le site web ?\n\n• Noms, catégories et photos seront mis à jour\n• Prix et descriptions déjà saisis ne seront pas effacés\n• Les produits déjà importés seront mis à jour',
      )
    ) {
      return;
    }

    setImportingFromSite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('sync-woocommerce-gallery', {
        body: {},
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });

      if (response.error) {
        const ctx = (response.error as { context?: Response }).context;
        let detail = response.error.message;
        if (ctx) {
          try {
            const body = await ctx.json();
            if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
              detail = body.error;
            }
          } catch {
            /* ignore */
          }
        }
        if (detail.includes('Failed to send') || detail.includes('FunctionsFetchError')) {
          detail =
            'Fonction non disponible. Déployez sync-woocommerce-gallery sur Supabase (voir instructions) puis réessayez.';
        }
        throw new Error(detail);
      }

      const payload = response.data as {
        ok?: boolean;
        error?: string;
        created?: number;
        updated?: number;
        products?: number;
        categories?: number;
      };

      if (payload?.error) {
        throw new Error(payload.error);
      }

      if (!payload?.ok) {
        throw new Error('Import échoué');
      }

      await Promise.all([fetchItems(), fetchCategories()]);

      toast({
        title: 'Import terminé',
        description: `${payload.created ?? 0} ajouté(s), ${payload.updated ?? 0} mis à jour — ${payload.products ?? 0} produit(s) sur le site.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import impossible';
      toast({
        variant: 'destructive',
        title: 'Import site web',
        description: message,
      });
    } finally {
      setImportingFromSite(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-48 justify-between font-normal">
                {filterCategory === 'all' ? 'Toutes les catégories' : filterCategory}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher..." value={filterSearch} onValueChange={setFilterSearch} />
                <CommandList className="max-h-[220px] overflow-y-auto overscroll-contain touch-pan-y" onWheel={(e) => e.stopPropagation()}>
                  <CommandEmpty>Aucune catégorie</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="Toutes les catégories"
                      onSelect={() => { setFilterCategory('all'); setFilterSearch(''); setFilterPopoverOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", filterCategory === 'all' ? "opacity-100" : "opacity-0")} />
                      Toutes les catégories
                    </CommandItem>
                    {categoryChoices.map(c => (
                      <CommandItem
                        key={c}
                        value={c}
                        onSelect={() => { setFilterCategory(c); setFilterSearch(''); setFilterPopoverOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", filterCategory === c ? "opacity-100" : "opacity-0")} />
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleRefreshGallery()}
              disabled={refreshing}
              title="Recharger la galerie depuis la base (sans sync automatique)"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Actualiser
            </Button>
            {GALLERY_WOOCOMMERCE_IMPORT_ENABLED && (
            <Button
              variant="outline"
              onClick={() => void handleImportFromWebsite()}
              disabled={importingFromSite}
            >
              {importingFromSite ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Importer depuis le site
            </Button>
            )}
            <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
              <Tag className="w-4 h-4 mr-2" />
              Catégories
            </Button>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucun élément</p>
          <p className="text-sm">
            {items.length === 0
              ? 'Ajoutez une fiche avec photos, prix TTC et fiches techniques pour répondre vite aux clients.'
              : 'Aucun résultat pour cette recherche'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedItems.map(item => (
            <div
              key={item.id}
              className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col"
            >
              <button
                type="button"
                className="relative aspect-square bg-muted cursor-pointer overflow-hidden w-full text-left border-0 p-0"
                onClick={() => openQuickView(item)}
              >
                {item.photos.length > 0 ? (
                  <img
                    src={item.photos[0]}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 opacity-30" />
                    <span className="text-xs px-2 text-center">Vue rapide (prix / fiches)</span>
                  </div>
                )}
                {item.photos.length > 1 && (
                  <Badge className="absolute top-2 right-2 bg-foreground/70 text-background text-xs">
                    {item.photos.length} photos
                  </Badge>
                )}
                {item.prix_vente_ttc != null && Number.isFinite(item.prix_vente_ttc) && item.prix_vente_ttc > 0 && (
                  <Badge className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                    {formatTnd(item.prix_vente_ttc)}
                  </Badge>
                )}
                {item.fiches_techniques.length > 0 && (
                  <Badge variant="secondary" className="absolute top-2 left-2 text-xs gap-1">
                    <FileText className="w-3 h-3" />
                    {item.fiches_techniques.length} fiche{item.fiches_techniques.length > 1 ? 's' : ''}
                  </Badge>
                )}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center pointer-events-none">
                  <Eye className="w-8 h-8 text-background opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-md" />
                </div>
              </button>

              <div className="p-3 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 min-h-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.category}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-3 flex flex-col gap-2">
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => openQuickView(item)}>
                    <Eye className="w-3 h-3 mr-1" />
                    Vue rapide
                  </Button>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(item)}>
                        <Edit className="w-3 h-3 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} élément{filtered.length !== 1 ? 's' : ''} — Page {currentPage}/{totalPages}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, page, idx, arr) => {
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...' + idx);
                  acc.push(page);
                  return acc;
                }, [])
                .map(page =>
                  typeof page === 'string' ? (
                    <PaginationItem key={page}>
                      <span className="px-3 py-2 text-muted-foreground">...</span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Modifier la fiche' : 'Nouvelle fiche produit'}</DialogTitle>
            <DialogDescription>
              Photos, prix vente/achat, devis fournisseur et fiches techniques.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nom du produit (visible en galerie)" />
            </div>

            <div>
              <Label>Catégorie</Label>
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {formCategory || "Sélectionner une catégorie"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-[9999]" align="start" side="bottom" avoidCollisions={false}>
                  <Command>
                    <CommandInput placeholder="Rechercher ou taper une catégorie..." value={categorySearch} onValueChange={setCategorySearch} />
                    <CommandList className="max-h-[220px] overflow-y-auto overscroll-contain touch-pan-y" onWheel={(e) => e.stopPropagation()}>
                      <CommandEmpty>
                        {categorySearch.trim() ? (
                          <button
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                            onClick={() => {
                              const v = categorySearch.trim();
                              if (v === 'Général') {
                                toast({
                                  variant: 'destructive',
                                  title: 'Non autorisé',
                                  description: 'Utilisez une catégorie inventaire ou un autre nom.',
                                });
                                return;
                              }
                              setFormCategory(v);
                              setCategorySearch('');
                              setCategoryPopoverOpen(false);
                            }}
                          >
                            Utiliser "{categorySearch.trim()}"
                          </button>
                        ) : "Aucune catégorie trouvée"}
                      </CommandEmpty>
                      <CommandGroup>
                        {choicesForForm.map(c => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setFormCategory(c);
                              setCategorySearch('');
                              setCategoryPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formCategory === c ? "opacity-100" : "opacity-0")} />
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Description</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Référence, remarque pour l’équipe…" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Prix vente TTC (TND)</Label>
                <Input
                  value={formPrixTtc}
                  onChange={e => setFormPrixTtc(filterDecimalDraft(e.target.value))}
                  inputMode="decimal"
                  placeholder="ex. 58,500"
                />
                <p className="text-xs text-muted-foreground mt-1">Prix public — réseaux sociaux / clients.</p>
              </div>
              <div>
                <Label>Prix d&apos;achat TTC (TND)</Label>
                <Input
                  value={formPrixAchat}
                  onChange={e => setFormPrixAchat(filterDecimalDraft(e.target.value))}
                  inputMode="decimal"
                  placeholder="ex. 42,000"
                />
                <p className="text-xs text-muted-foreground mt-1">Usage interne — visible en vue rapide.</p>
              </div>
            </div>

            {/* Devis fournisseur */}
            <div>
              <Label>Devis (PDF ou image)</Label>
              <div className="mt-2 space-y-2 rounded-lg border border-border p-3 bg-muted/20">
                {formDevis.map((url, i) => (
                  <div key={`${url}-${i}`} className="flex items-center gap-2 text-sm">
                    <Receipt className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1 min-w-0">
                      Devis {i + 1}
                    </a>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={() => removeDevis(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingDevis}
                  onClick={() => devisInputRef.current?.click()}
                >
                  {uploadingDevis ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Ajouter un devis
                </Button>
                <input
                  ref={devisInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleDevisUpload}
                />
              </div>
            </div>

            {/* Fiches techniques */}
            <div>
              <Label>Fiches techniques (PDF ou image)</Label>
              <div className="mt-2 space-y-2 rounded-lg border border-border p-3 bg-muted/20">
                {formFiches.map((url, i) => (
                  <div key={`${url}-${i}`} className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1 min-w-0">
                      Fiche {i + 1}
                    </a>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={() => removeFiche(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFiche}
                  onClick={() => ficheInputRef.current?.click()}
                >
                  {uploadingFiche ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Ajouter une fiche
                </Button>
                <input
                  ref={ficheInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFicheUpload}
                />
              </div>
            </div>

            {/* Photos */}
            <div>
              <Label>Photos</Label>
              <div
                className={cn(
                  "grid grid-cols-3 gap-2 mt-2 p-3 rounded-lg border-2 border-dashed transition-colors",
                  dragOver ? "border-primary bg-primary/10" : "border-border"
                )}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  const files = e.dataTransfer.files;
                  if (!files || files.length === 0) return;
                  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                  if (imageFiles.length === 0) return;
                  setUploading(true);
                  const newUrls: string[] = [];
                  for (const file of imageFiles) {
                    const ext = file.name.split('.').pop();
                    const path = buildCompanyStoragePath(`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
                    const { error } = await supabase.storage.from('gallery-photos').upload(path, file, { upsert: true });
                    if (!error) {
                      const { data: urlData } = supabase.storage.from('gallery-photos').getPublicUrl(path);
                      newUrls.push(urlData.publicUrl);
                    }
                  }
                  setFormPhotos(prev => [...prev, ...newUrls]);
                  setUploading(false);
                }}
              >
                {formPhotos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">Ajouter</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Glissez-déposez vos photos ici ou cliquez pour en ajouter</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingItem ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vue rapide : prix, fiches, photos */}
      <Dialog open={!!quickViewItem} onOpenChange={open => { if (!open) setQuickViewItem(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6">{quickViewItem?.name}</DialogTitle>
            <DialogDescription>
              {quickViewItem?.category ? `${quickViewItem.category} · ` : ''}
              Prix, devis fournisseur et fiches techniques
            </DialogDescription>
          </DialogHeader>
          {quickViewItem && (
            <div className="space-y-5">
              {quickViewItem.photos.length > 0 ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                  <div className="flex items-center justify-center min-h-[220px] max-h-[50vh]">
                    <img
                      src={quickViewItem.photos[quickViewPhotoIndex]}
                      alt={quickViewItem.name}
                      className="max-w-full max-h-[50vh] object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  {quickViewItem.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickViewPhotoIndex(i =>
                            (i - 1 + quickViewItem.photos.length) % quickViewItem.photos.length
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/90 border shadow-sm hover:bg-accent"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickViewPhotoIndex(i => (i + 1) % quickViewItem.photos.length)
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/90 border shadow-sm hover:bg-accent"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {quickViewItem.photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto p-3 border-t border-border bg-card justify-center">
                      {quickViewItem.photos.map((photo, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setQuickViewPhotoIndex(i)}
                          className={cn(
                            'flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all',
                            i === quickViewPhotoIndex ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'
                          )}
                        >
                          <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                  Aucune photo — vous pouvez en ajouter via « Modifier ».
                </div>
              )}

              {(quickViewItem.prix_vente_ttc != null &&
                Number.isFinite(quickViewItem.prix_vente_ttc) &&
                quickViewItem.prix_vente_ttc > 0) ||
              (quickViewItem.prix_achat_ttc != null &&
                Number.isFinite(quickViewItem.prix_achat_ttc) &&
                quickViewItem.prix_achat_ttc > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickViewItem.prix_vente_ttc != null &&
                    Number.isFinite(quickViewItem.prix_vente_ttc) &&
                    quickViewItem.prix_vente_ttc > 0 && (
                      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prix vente TTC</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums">{formatTnd(quickViewItem.prix_vente_ttc)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            const text = formatTnd(quickViewItem.prix_vente_ttc!);
                            try {
                              await navigator.clipboard.writeText(text);
                              toast({ title: 'Copié', description: 'Prix vente collé dans le presse-papiers.' });
                            } catch {
                              toast({ variant: 'destructive', title: 'Copie impossible', description: 'Sélectionnez le prix manuellement.' });
                            }
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copier
                        </Button>
                      </div>
                    )}
                  {quickViewItem.prix_achat_ttc != null &&
                    Number.isFinite(quickViewItem.prix_achat_ttc) &&
                    quickViewItem.prix_achat_ttc > 0 && (
                      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prix d&apos;achat TTC</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums">{formatTnd(quickViewItem.prix_achat_ttc)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            const text = formatTnd(quickViewItem.prix_achat_ttc!);
                            try {
                              await navigator.clipboard.writeText(text);
                              toast({ title: 'Copié', description: "Prix d'achat collé dans le presse-papiers." });
                            } catch {
                              toast({ variant: 'destructive', title: 'Copie impossible', description: 'Sélectionnez le prix manuellement.' });
                            }
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copier
                        </Button>
                      </div>
                    )}
                </div>
              ) : null}

              {quickViewItem.devis_fichiers.length > 0 && (
                <div>
                  <Label className="text-base">Devis fournisseur</Label>
                  <div className="mt-2 flex flex-col gap-2">
                    {quickViewItem.devis_fichiers.map((url, i) => (
                      <Button
                        key={`${url}-${i}`}
                        type="button"
                        variant="outline"
                        className="w-full justify-start h-auto py-3"
                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      >
                        <Receipt className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate text-left">Ouvrir le devis {i + 1}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {quickViewItem.fiches_techniques.length > 0 && (
                <div>
                  <Label className="text-base">Fiches techniques</Label>
                  <div className="mt-2 flex flex-col gap-2">
                    {quickViewItem.fiches_techniques.map((url, i) => (
                      <Button
                        key={`${url}-${i}`}
                        type="button"
                        variant="outline"
                        className="w-full justify-start h-auto py-3"
                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate text-left">Ouvrir la fiche {i + 1}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {quickViewItem.description && (
                <p className="text-sm text-muted-foreground border-t border-border pt-4">{quickViewItem.description}</p>
              )}

              {(!quickViewItem.prix_vente_ttc || quickViewItem.prix_vente_ttc <= 0) &&
                (!quickViewItem.prix_achat_ttc || quickViewItem.prix_achat_ttc <= 0) &&
                quickViewItem.devis_fichiers.length === 0 &&
                quickViewItem.fiches_techniques.length === 0 &&
                quickViewItem.photos.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ajoutez au moins un prix, un devis, une fiche ou une photo via « Modifier ».
                  </p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Gérer les Catégories</DialogTitle>
            <DialogDescription>Ajoutez, modifiez ou supprimez les catégories de la galerie</DialogDescription>
          </DialogHeader>

          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              placeholder="Nouvelle catégorie..."
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Category list */}
          <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            {dbCategories.map(cat => {
              const itemCount = items.filter(i => i.category === cat.name).length;
              return (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                  {editingCategory?.id === cat.id ? (
                    <>
                      <Input
                        value={editCategoryName}
                        onChange={e => setEditCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateCategory()}
                        className="flex-1 h-8"
                        autoFocus
                      />
                      <Button size="sm" variant="outline" onClick={handleUpdateCategory}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">{itemCount}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingCategory(cat); setEditCategoryName(cat.name); }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCategory(cat)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

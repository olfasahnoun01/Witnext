import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Package, Layers, Search, Filter } from 'lucide-react';
import { Product, ProductGroup } from '@/types';
import { getProductGroupsByCategory, getVariantsByGroupId, getProductGroupCountsByCategory } from '@/services/productGroupService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LazyProductImage } from '@/components/shared/LazyProductImage';

const MAIN_CATEGORIES = [
  'Pantalons',
  'Blousons', 
  'Bordequin',
  'Accessoires',
  'Gants',
  'Casques',
  'Gilets',
  'POLOS & T-SHIRTS',
  'Parkas et manteaux',
  'Tablier'
];

interface CategoryProductSelectorProps {
  onSelect: (product: Product) => void;
  onGroupSelect?: (group: ProductGroup, variants: Product[]) => void;
  selectedProductId: number | '';
}

type ViewState = 'categories' | 'products' | 'variants';

// In-memory cache to avoid re-fetching on back navigation
const groupsCache = new Map<string, { data: ProductGroup[]; ts: number }>();
const variantsCache = new Map<number, { data: Product[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCachedGroups(category: string) {
  const entry = groupsCache.get(category);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function getCachedVariants(groupId: number) {
  const entry = variantsCache.get(groupId);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

export const CategoryProductSelector = ({ onSelect, onGroupSelect, selectedProductId }: CategoryProductSelectorProps) => {
  const [viewState, setViewState] = useState<ViewState>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [variants, setVariants] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('all');
  const countsLoaded = useRef(false);
  const categoryRequestIdRef = useRef(0);
  const variantsRequestIdRef = useRef(0);

  // Load category counts on mount (once)
  useEffect(() => {
    if (countsLoaded.current) return;
    countsLoaded.current = true;
    getProductGroupCountsByCategory()
      .then(setCategoryCounts)
      .catch(() => toast.error('Erreur lors du chargement des catégories'));
  }, []);

  // Get sorted categories with counts
  const sortedCategories = useMemo(() => {
    const allCategories = Object.keys(categoryCounts);
    return allCategories.sort((a, b) => {
      const aIndex = MAIN_CATEGORIES.indexOf(a);
      const bIndex = MAIN_CATEGORIES.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b, 'fr');
    });
  }, [categoryCounts]);

  // Load product groups when category is selected - with cache
  const handleCategorySelect = useCallback(async (category: string) => {
    const requestId = ++categoryRequestIdRef.current;
    setSelectedCategory(category);
    setViewState('products');
    setSearchQuery('');
    setSelectedFournisseur('all');
    
    const cached = getCachedGroups(category);
    if (cached) {
      setProductGroups(cached);
      return;
    }

    setIsLoading(true);
    try {
      const groups = await getProductGroupsByCategory(category);
      if (requestId !== categoryRequestIdRef.current) return;
      setProductGroups(groups);
      groupsCache.set(category, { data: groups, ts: Date.now() });
    } catch (error) {
      console.error('Error loading product groups:', error);
      toast.error('Erreur lors du chargement des groupes produits');
    } finally {
      if (requestId === categoryRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Load variants when product group is selected - with cache
  const handleGroupSelect = useCallback(async (group: ProductGroup) => {
    const requestId = ++variantsRequestIdRef.current;
    setSelectedGroup(group);
    setViewState('variants');
    setSearchQuery('');

    const cached = getCachedVariants(group.id);
    if (cached) {
      setVariants(cached);
      onGroupSelect?.(group, cached);
      return;
    }

    setIsLoading(true);
    try {
      const variantsData = await getVariantsByGroupId(group.id);
      if (requestId !== variantsRequestIdRef.current) return;
      setVariants(variantsData);
      variantsCache.set(group.id, { data: variantsData, ts: Date.now() });
      onGroupSelect?.(group, variantsData);
    } catch (error) {
      console.error('Error loading variants:', error);
      toast.error('Erreur lors du chargement des variantes');
    } finally {
      if (requestId === variantsRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [onGroupSelect]);

  const handleVariantSelect = useCallback((product: Product) => {
    onSelect(product);
  }, [onSelect]);

  const handleBack = useCallback(() => {
    if (viewState === 'variants') {
      setViewState('products');
      setSelectedGroup(null);
      setVariants([]);
      setSearchQuery('');
    } else if (viewState === 'products') {
      setViewState('categories');
      setSelectedCategory(null);
      setProductGroups([]);
      setSelectedFournisseur('all');
      setSearchQuery('');
    }
  }, [viewState]);

  const availableFournisseurs = useMemo(() => {
    const fournisseurSet = new Set<string>();
    productGroups.forEach(g => {
      if (g.fournisseur) fournisseurSet.add(g.fournisseur);
      g.fournisseurs?.forEach(f => fournisseurSet.add(f.fournisseur_name));
    });
    return Array.from(fournisseurSet).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [productGroups]);

  const filteredGroups = useMemo(() => {
    let filtered = productGroups;
    if (selectedFournisseur && selectedFournisseur !== 'all') {
      filtered = filtered.filter(g => 
        g.fournisseur === selectedFournisseur ||
        g.fournisseurs?.some(f => f.fournisseur_name === selectedFournisseur)
      );
    }
    if (!searchQuery) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(g => 
      g.name.toLowerCase().includes(query) ||
      g.base_sku?.toLowerCase().includes(query)
    );
  }, [productGroups, searchQuery, selectedFournisseur]);

  const filteredVariants = useMemo(() => {
    if (!searchQuery) return variants;
    const query = searchQuery.toLowerCase();
    return variants.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.sku.toLowerCase().includes(query) ||
      v.size?.toLowerCase().includes(query) ||
      v.color?.toLowerCase().includes(query)
    );
  }, [variants, searchQuery]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 border-b border-border">
        {viewState !== 'categories' && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex items-center gap-1 text-sm">
          <span 
            className={`cursor-pointer hover:text-primary ${viewState === 'categories' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            onClick={() => { setViewState('categories'); setSelectedCategory(null); setSelectedGroup(null); setSearchQuery(''); }}
          >
            Catégories
          </span>
          {selectedCategory && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span 
                className={`cursor-pointer hover:text-primary ${viewState === 'products' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                onClick={() => { setViewState('products'); setSelectedGroup(null); setSearchQuery(''); }}
              >
                {selectedCategory}
              </span>
            </>
          )}
          {selectedGroup && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium text-foreground truncate max-w-32">{selectedGroup.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      {viewState !== 'categories' && (
        <div className="p-2 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          {viewState === 'products' && availableFournisseurs.length > 0 && (
            <Select value={selectedFournisseur} onValueChange={setSelectedFournisseur}>
              <SelectTrigger className="h-8 text-sm">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Filtrer par fournisseur" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                {availableFournisseurs.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Content */}
      <ScrollArea className="h-64">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : viewState === 'categories' ? (
          <div className="grid grid-cols-2 gap-2 p-2">
            {sortedCategories.map(category => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 transition-all text-left group"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  <span className="text-sm font-medium truncate">{category}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{categoryCounts[category] || 0}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        ) : viewState === 'products' ? (
          <div className="divide-y divide-border">
            {filteredGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit dans cette catégorie'}
              </p>
            ) : (
              filteredGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <LazyProductImage
                    groupId={group.id}
                    alt={group.name}
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.base_sku && `${group.base_sku} • `}
                      {group.variant_count || 0} variante(s) • Stock: {group.total_stock || 0}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredVariants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? 'Aucune variante trouvée' : 'Aucune variante disponible'}
              </p>
            ) : (
              filteredVariants.map(variant => (
                <button
                  key={variant.id}
                  onClick={() => handleVariantSelect(variant)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left ${
                    selectedProductId === variant.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                  }`}
                >
                  <LazyProductImage
                    productId={variant.id}
                    alt={variant.name}
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{variant.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{variant.sku}</span>
                      {variant.size && <span>• Taille: {variant.size}</span>}
                      {variant.color && <span>• {variant.color}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-medium ${
                      variant.quantity === 0 ? 'text-destructive' : variant.quantity <= variant.min_stock ? 'text-warning' : 'text-success'
                    }`}>
                      {variant.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">en stock</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Package, Layers, Search, Filter } from 'lucide-react';
import { Product, ProductGroup } from '@/types';
import { getProductGroupsByCategory, getVariantsByGroupId } from '@/services/productGroupService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  // Load category counts on mount
  useEffect(() => {
    loadCategoryCounts();
  }, []);

  const loadCategoryCounts = async () => {
    try {
      const { getProductGroupCountsByCategory } = await import('@/services/productGroupService');
      const counts = await getProductGroupCountsByCategory();
      setCategoryCounts(counts);
    } catch (error) {
      console.error('Error loading category counts:', error);
    }
  };

  // Get sorted categories with counts
  const sortedCategories = useMemo(() => {
    const allCategories = Object.keys(categoryCounts);
    
    // Sort: main categories first in order, then others alphabetically
    return allCategories.sort((a, b) => {
      const aIndex = MAIN_CATEGORIES.indexOf(a);
      const bIndex = MAIN_CATEGORIES.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b, 'fr');
    });
  }, [categoryCounts]);

  // Load product groups when category is selected
  const handleCategorySelect = async (category: string) => {
    setSelectedCategory(category);
    setIsLoading(true);
    setViewState('products');
    
    try {
      const groups = await getProductGroupsByCategory(category);
      setProductGroups(groups);
    } catch (error) {
      console.error('Error loading product groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load variants when product group is selected
  const handleGroupSelect = async (group: ProductGroup) => {
    setSelectedGroup(group);
    setIsLoading(true);
    setViewState('variants');
    
    try {
      const variantsData = await getVariantsByGroupId(group.id);
      setVariants(variantsData);
      // Notify parent that a group was selected with its variants
      onGroupSelect?.(group, variantsData);
    } catch (error) {
      console.error('Error loading variants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle variant selection
  const handleVariantSelect = (product: Product) => {
    onSelect(product);
  };

  // Handle back navigation
  const handleBack = () => {
    if (viewState === 'variants') {
      setViewState('products');
      setSelectedGroup(null);
      setVariants([]);
    } else if (viewState === 'products') {
      setViewState('categories');
      setSelectedCategory(null);
      setProductGroups([]);
      setSelectedFournisseur('all');
    }
  };

  // Extract unique fournisseurs from current product groups
  const availableFournisseurs = useMemo(() => {
    const fournisseurSet = new Set<string>();
    productGroups.forEach(g => {
      if (g.fournisseur) fournisseurSet.add(g.fournisseur);
      g.fournisseurs?.forEach(f => fournisseurSet.add(f.fournisseur_name));
    });
    return Array.from(fournisseurSet).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [productGroups]);

  // Filter items based on search and fournisseur
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
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
            className="h-8 px-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex items-center gap-1 text-sm">
          <span 
            className={`cursor-pointer hover:text-primary ${viewState === 'categories' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            onClick={() => {
              setViewState('categories');
              setSelectedCategory(null);
              setSelectedGroup(null);
              setSearchQuery('');
            }}
          >
            Catégories
          </span>
          {selectedCategory && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span 
                className={`cursor-pointer hover:text-primary ${viewState === 'products' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                onClick={() => {
                  setViewState('products');
                  setSelectedGroup(null);
                  setSearchQuery('');
                }}
              >
                {selectedCategory}
              </span>
            </>
          )}
          {selectedGroup && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium text-foreground truncate max-w-32">
                {selectedGroup.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Search (only for products and variants) */}
      {viewState !== 'categories' && (
        <div className="p-2 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
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
          <div className="flex items-center justify-center h-full py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : viewState === 'categories' ? (
          // Categories view
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
          // Product groups view
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
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {group.image ? (
                      <img src={group.image} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
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
          // Variants view
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
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {variant.image ? (
                      <img src={variant.image} alt={variant.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
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
                      variant.quantity === 0 
                        ? 'text-destructive' 
                        : variant.quantity <= variant.min_stock 
                          ? 'text-warning' 
                          : 'text-success'
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

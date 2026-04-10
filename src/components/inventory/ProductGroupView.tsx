import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, RefreshCw, Search, X, Check, ChevronsUpDown } from 'lucide-react';
import { ProductGroup } from '@/types';
import { getProductGroupsByCategory, deleteProductGroup } from '@/services/productGroupService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductGroupCard } from './ProductGroupCard';
import { VariantView } from './VariantView';
import { ProductGroupModal } from './ProductGroupModal';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
import { cn } from '@/lib/utils';
import { sanitizeSearchInput } from '@/lib/sanitize';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProductGroupViewProps {
  category: string;
  onBack: () => void;
}

const ITEMS_PER_PAGE = 12;

export const ProductGroupView = ({ category, onBack }: ProductGroupViewProps) => {
  const { isModerator } = useAuth();
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [isProductGroupModalOpen, setIsProductGroupModalOpen] = useState(false);
  const [editingProductGroup, setEditingProductGroup] = useState<ProductGroup | null>(null);
  
  // Supplier filter state
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('');
  const [fournisseurOpen, setFournisseurOpen] = useState(false);
  
  // Handle deep linking search from DevisHelper
  useEffect(() => {
    const targetSearch = localStorage.getItem('grosafe_inventory_search');
    if (targetSearch) {
      setSearchQuery(targetSearch);
      localStorage.removeItem('grosafe_inventory_search');
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProductGroupsByCategory(category);
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  // Fetch fournisseurs - use product_group_fournisseurs which is accessible to all roles
  const fetchFournisseurs = useCallback(async () => {
    try {
      // First try to get from fournisseurs table (admin/moderator)
      const { data: fournisseursData, error: fournisseursError } = await supabase
        .from('fournisseurs')
        .select('nom')
        .order('nom');
      
      if (!fournisseursError && fournisseursData?.length) {
        setFournisseurs(fournisseursData.map(f => f.nom));
        return;
      }
      
      // Fallback: get unique fournisseur names from product_group_fournisseurs (accessible to all)
      const { data: pgfData, error: pgfError } = await supabase
        .from('product_group_fournisseurs')
        .select('fournisseur_name');
      
      if (pgfError) throw pgfError;
      
      const uniqueNames = [...new Set(pgfData?.map(f => f.fournisseur_name) || [])].sort();
      setFournisseurs(uniqueNames);
    } catch (error) {
      console.error('Error fetching fournisseurs:', error);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchFournisseurs();
  }, [fetchGroups, fetchFournisseurs]);

  // Subscribe to realtime changes on products and product_groups
  useRealtimeData({
    tables: ['products', 'product_groups'],
    onDataChange: fetchGroups,
    showToast: true
  });

  // Calculate product count per fournisseur in current category
  const fournisseurCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach(group => {
      if (group.fournisseur) {
        const key = group.fournisseur.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [groups]);

  // Filter groups by search and fournisseur
  const filteredGroups = useMemo(() => {
    let result = groups;
    
    // Filter by fournisseur first
    if (selectedFournisseur) {
      result = result.filter(g => 
        g.fournisseur?.toLowerCase() === selectedFournisseur.toLowerCase()
      );
    }
    
    // Then filter by search
    if (searchQuery) {
      const sanitized = sanitizeSearchInput(searchQuery)?.toLowerCase();
      if (sanitized) {
        result = result.filter(g => 
          g.name.toLowerCase().includes(sanitized) ||
          g.base_sku?.toLowerCase().includes(sanitized) ||
          g.fournisseur?.toLowerCase().includes(sanitized)
        );
      }
    }
    
    return result;
  }, [groups, searchQuery, selectedFournisseur]);

  // Paginate
  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGroups.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGroups, currentPage]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFournisseur]);

  const handleGroupClick = useCallback((group: ProductGroup) => {
    setSelectedGroup(group);
  }, []);

  const handleEditGroup = useCallback((group: ProductGroup) => {
    setEditingProductGroup(group);
    setIsProductGroupModalOpen(true);
  }, []);

  const handleBackFromVariants = useCallback(() => {
    setSelectedGroup(null);
    fetchGroups(); // Refresh in case stock changed
  }, [fetchGroups]);

  const handleDeleteGroup = useCallback(async (group: ProductGroup) => {
    const variantCount = group.variant_count || 0;
    const confirmMessage = variantCount > 0
      ? `Supprimer l'article "${group.name}" et ses ${variantCount} variante${variantCount > 1 ? 's' : ''} ? Les fiches techniques et images seront aussi supprimées.`
      : `Supprimer l'article "${group.name}" ?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      // Collect storage paths to delete
      const storagePaths: string[] = [];

      // Helper: extract storage path from public URL
      const extractPath = (url: string | null | undefined) => {
        if (!url) return;
        // URL format: .../storage/v1/object/public/bucket-name/path
        const marker = '/fiches-techniques/';
        const idx = url.indexOf(marker);
        if (idx !== -1) storagePaths.push(url.substring(idx + marker.length));
      };

      // Get variants' fiche_technique_url and image
      if (variantCount > 0) {
        const { data: variants } = await supabase
          .from('products')
          .select('fiche_technique_url, image')
          .eq('product_group_id', group.id);

        variants?.forEach(v => {
          // Parse fiche URLs (could be JSON array or single URL)
          if (v.fiche_technique_url) {
            const trimmed = v.fiche_technique_url.trim();
            let urls: string[] = [];
            if (trimmed.startsWith('[')) {
              try { urls = JSON.parse(trimmed); } catch { urls = [trimmed]; }
            } else {
              urls = [trimmed];
            }
            urls.forEach(extractPath);
          }
          // Variant images stored in fiches-techniques bucket
          extractPath(v.image);
        });
      }

      // Get fournisseurs' fiche_technique_url
      const { data: pgf } = await supabase
        .from('product_group_fournisseurs')
        .select('fiche_technique_url')
        .eq('product_group_id', group.id);

      pgf?.forEach(f => {
        if (f.fiche_technique_url) {
          const trimmed = f.fiche_technique_url.trim();
          let urls: string[] = [];
          if (trimmed.startsWith('[')) {
            try { urls = JSON.parse(trimmed); } catch { urls = [trimmed]; }
          } else {
            urls = [trimmed];
          }
          urls.forEach(extractPath);
        }
      });

      // Group image
      extractPath(group.image);

      // Delete files from storage (best effort)
      if (storagePaths.length > 0) {
        await supabase.storage.from('fiches-techniques').remove(storagePaths);
      }

      // Delete variants
      if (variantCount > 0) {
        const { error: variantsError } = await supabase
          .from('products')
          .delete()
          .eq('product_group_id', group.id);
        
        if (variantsError) throw variantsError;
      }

      // Delete fournisseurs links
      await supabase.from('product_group_fournisseurs').delete().eq('product_group_id', group.id);
      
      // Then delete the product group
      await deleteProductGroup(group.id);
      toast.success(`Article "${group.name}" supprimé avec succès`);
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting product group:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  }, [fetchGroups]);

  // Page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1);
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push(-2);
        pages.push(totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  // Show variant view if a group is selected
  if (selectedGroup) {
    return (
      <VariantView 
        group={selectedGroup} 
        onBack={handleBackFromVariants}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{category}</h2>
            <p className="text-sm text-muted-foreground">
              {filteredGroups.length} produit{filteredGroups.length !== 1 ? 's' : ''} • {groups.reduce((sum, g) => sum + (g.variant_count || 0), 0)} variantes au total
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchGroups} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setIsProductGroupModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Produit
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Fournisseur Filter */}
        <Popover open={fournisseurOpen} onOpenChange={setFournisseurOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={fournisseurOpen}
              className="w-[220px] justify-between"
            >
              {selectedFournisseur || "Filtrer par fournisseur"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher fournisseur..." />
              <CommandList>
                <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
                <CommandGroup>
                  {fournisseurs.map((fournisseur) => {
                    const count = fournisseurCounts[fournisseur.toLowerCase()] || 0;
                    return (
                      <CommandItem
                        key={fournisseur}
                        value={fournisseur}
                        onSelect={(value) => {
                          setSelectedFournisseur(value === selectedFournisseur ? '' : value);
                          setFournisseurOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedFournisseur === fournisseur ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{fournisseur}</span>
                        {count > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {count}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        {/* Clear filter button */}
        {selectedFournisseur && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedFournisseur('')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Effacer filtre
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : paginatedGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'Aucun produit trouvé pour cette recherche.' : 'Aucun produit dans cette catégorie.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsProductGroupModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter le premier produit
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedGroups.map((group) => (
              <ProductGroupCard
                key={group.id}
                group={group}
                onClick={() => handleGroupClick(group)}
                onEdit={handleEditGroup}
                onDelete={handleDeleteGroup}
                canEdit={isModerator}
                canDelete={isModerator}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {pageNumbers.map((page, index) => (
                    <PaginationItem key={index}>
                      {page < 0 ? (
                        <span className="px-3 py-2">...</span>
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
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
        </>
      )}

      {/* Product Group Modal */}
      <ProductGroupModal
        isOpen={isProductGroupModalOpen}
        onClose={() => {
          setIsProductGroupModalOpen(false);
          setEditingProductGroup(null);
        }}
        onSuccess={fetchGroups}
        defaultCategory={category}
        editingGroup={editingProductGroup}
      />
    </div>
  );
};

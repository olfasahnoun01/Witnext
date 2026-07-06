import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, RefreshCw, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryCard, getCategoryColor } from './inventory/CategoryCard';
import { CategoryEditModal } from './inventory/CategoryEditModal';
import { ProductGroupView } from './inventory/ProductGroupView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProductGroupCategoryStats } from '@/hooks/useProductGroupCategoryStats';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Inventory = () => {
  const { isModerator } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryCount, setEditingCategoryCount] = useState(0);
  const [categorySearch, setCategorySearch] = useState('');
  const [categorySearchApplied, setCategorySearchApplied] = useState('');

  const {
    isLoading,
    sortedCategories,
    uncategorizedCount,
    totalProducts,
    customCategoryNames,
    MAIN_CATEGORIES,
    getCategoryDisplayColor,
    refresh,
    refreshCounts,
  } = useProductGroupCategoryStats();

  const filteredCategories = useMemo(() => {
    const q = categorySearchApplied.trim().toLowerCase();
    if (!q) return sortedCategories;
    return sortedCategories.filter(({ category }) => category.toLowerCase().includes(q));
  }, [sortedCategories, categorySearchApplied]);

  const showUncategorized =
    uncategorizedCount > 0 &&
    (!categorySearchApplied.trim() || 'non catégorisé'.includes(categorySearchApplied.trim().toLowerCase()));

  // Handle deep linking from DevisHelper
  useEffect(() => {
    const targetCategory = localStorage.getItem('grosafe_inventory_category');
    if (targetCategory) {
      setSelectedCategory(targetCategory);
      localStorage.removeItem('grosafe_inventory_category');
    }
  }, []);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    
    const exists = MAIN_CATEGORIES.some(
      cat => cat.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    
    if (exists) {
      toast.error('Cette catégorie existe déjà');
      return;
    }
    
    const { error } = await supabase
      .from('category_settings')
      .insert({ category_name: newCategoryName.trim(), is_custom: true });

    if (error) {
      toast.error('Erreur lors de l\'ajout de la catégorie');
      return;
    }

    await refresh();
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
    toast.success(`Catégorie "${newCategoryName.trim()}" ajoutée`);
  }, [newCategoryName, MAIN_CATEGORIES, refresh]);

  const handleEditCategory = useCallback((categoryName: string) => {
    const categoryData = sortedCategories.find(c => c.category === categoryName);
    setEditingCategory(categoryName);
    setEditingCategoryCount(categoryData?.count || 0);
  }, [sortedCategories]);

  const handleSaveCategory = useCallback(async (newName: string, newColor: string) => {
    if (!editingCategory) return;
    
    const isCustom = customCategoryNames.includes(editingCategory);
    const oldName = editingCategory;
    
    // Upsert the category setting in DB
    const { error: settingsError } = await supabase
      .from('category_settings')
      .upsert({
        category_name: isCustom && newName !== oldName ? newName : oldName,
        color: newColor,
        is_custom: isCustom,
      }, { onConflict: 'category_name' });

    if (settingsError) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }

    // If custom category was renamed, delete old row
    if (isCustom && newName !== oldName) {
      await supabase
        .from('category_settings')
        .delete()
        .eq('category_name', oldName);
    }
    
    // If name changed and there are products, update them in the database
    if (newName !== oldName && editingCategoryCount > 0) {
      try {
        const { error: groupsError } = await supabase
          .from('product_groups')
          .update({ category: newName })
          .ilike('category', oldName);
        
        if (groupsError) throw groupsError;
        
        const { error: productsError } = await supabase
          .from('products')
          .update({ category: newName })
          .ilike('category', oldName);
        
        if (productsError) throw productsError;
        
        toast.success(`Catégorie renommée de "${oldName}" à "${newName}"`);
      } catch (error) {
        console.error('Error updating category:', error);
        toast.error('Erreur lors de la mise à jour de la catégorie');
        return;
      }
    } else {
      toast.success('Catégorie mise à jour');
    }
    
    await refresh();
  }, [editingCategory, editingCategoryCount, customCategoryNames, refresh]);

  const handleDeleteCategory = useCallback(async () => {
    if (!editingCategory) return;
    
    if (!customCategoryNames.includes(editingCategory)) {
      toast.error('Les catégories par défaut ne peuvent pas être supprimées');
      return;
    }
    
    if (editingCategoryCount > 0) {
      toast.error('Impossible de supprimer une catégorie contenant des articles');
      return;
    }
    
    const { error } = await supabase
      .from('category_settings')
      .delete()
      .eq('category_name', editingCategory);

    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }

    await refresh();
    toast.success(`Catégorie "${editingCategory}" supprimée`);
  }, [editingCategory, editingCategoryCount, customCategoryNames, refresh]);

  const handleDirectDeleteCategory = useCallback((categoryName: string) => {
    const categoryData = sortedCategories.find(c => c.category === categoryName);
    const count = categoryData?.count || 0;
    
    if (!customCategoryNames.includes(categoryName)) {
      toast.error('Les catégories par défaut ne peuvent pas être supprimées');
      return;
    }
    
    if (count > 0) {
      toast.error('Impossible de supprimer une catégorie contenant des articles');
      return;
    }
    
    setEditingCategory(categoryName);
    setEditingCategoryCount(count);
  }, [sortedCategories, customCategoryNames]);

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
    void refreshCounts();
  }, [refreshCounts]);

  if (selectedCategory) {
    return <ProductGroupView category={selectedCategory} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Package className="w-7 h-7" />
            Inventaire par Catégorie
          </h2>
          <p className="text-muted-foreground mt-1">
            {totalProducts} produit{totalProducts !== 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex gap-2 flex-1 sm:flex-initial">
            <Input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Rechercher une catégorie…"
              className="sm:w-56"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setCategorySearchApplied(categorySearch);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCategorySearchApplied(categorySearch)}
            >
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
            {categorySearchApplied && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCategorySearch('');
                  setCategorySearchApplied('');
                }}
              >
                Effacer
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => void refreshCounts()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          {isModerator && (
            <Button onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter Catégorie
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCategories.map(({ category, count }) => {
              const isCustom = customCategoryNames.includes(category);
              const canDeleteThis = isModerator && isCustom && count === 0;
              return (
                <CategoryCard
                  key={category}
                  name={category}
                  count={count}
                  onClick={() => handleCategoryClick(category)}
                  onEdit={isModerator ? handleEditCategory : undefined}
                  onDelete={canDeleteThis ? handleDirectDeleteCategory : undefined}
                  canEdit={isModerator}
                  canDelete={canDeleteThis}
                  customColor={getCategoryDisplayColor(category)}
                />
              );
            })}
            
            {showUncategorized && (
              <CategoryCard
                name="Non catégorisé"
                count={uncategorizedCount}
                onClick={() => handleCategoryClick('Non catégorisé')}
              />
            )}
          </div>

          {/* Empty State */}
          {filteredCategories.length === 0 && !showUncategorized && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {categorySearchApplied ? 'Aucune catégorie trouvée' : 'Aucun produit'}
              </h3>
              <p className="text-muted-foreground">
                {categorySearchApplied
                  ? 'Essayez un autre terme de recherche.'
                  : 'Commencez par ajouter des produits à votre inventaire.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une nouvelle catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nom de la catégorie</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Chaussures de sécurité"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      {editingCategory && (
        <CategoryEditModal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          categoryName={editingCategory}
          categoryCount={editingCategoryCount}
          currentColor={getCategoryDisplayColor(editingCategory) || getCategoryColor(editingCategory)}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
          isCustomCategory={customCategoryNames.includes(editingCategory)}
        />
      )}
    </div>
  );
};

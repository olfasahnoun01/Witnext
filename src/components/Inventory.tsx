import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryCard, getCategoryColor } from './inventory/CategoryCard';
import { CategoryEditModal } from './inventory/CategoryEditModal';
import { ProductGroupView } from './inventory/ProductGroupView';
import { getProductGroupCountsByCategory } from '@/services/productGroupService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

// Default main categories - user can add more
const DEFAULT_CATEGORIES = [
  'Pantalons',
  'Blousons',
  'Bordequin',
  'Accessoires',
  'Gants',
  'Casques',
  'Gilets',
  'Polos & T-shirts',
  'Parkas et manteaux',
  'Tablier',
];

interface CategoryCount {
  category: string;
  count: number;
}

interface CategorySettingRow {
  id: number;
  category_name: string;
  color: string | null;
  is_custom: boolean;
}

export const Inventory = () => {
  const { isModerator } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [categorySettings, setCategorySettings] = useState<CategorySettingRow[]>([]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryCount, setEditingCategoryCount] = useState(0);

  // Fetch category settings from DB
  const fetchCategorySettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('category_settings')
      .select('id, category_name, color, is_custom');
    
    if (!error && data) {
      setCategorySettings(data as CategorySettingRow[]);
    }
  }, []);

  // Migrate localStorage data to DB on first load (one-time)
  const migrateLocalStorage = useCallback(async () => {
    const migrated = localStorage.getItem('grosafe_categories_migrated_to_db');
    if (migrated) return;

    const rows: { category_name: string; color: string | null; is_custom: boolean }[] = [];

    // Migrate custom categories
    const savedV2 = localStorage.getItem('grosafe_custom_categories_v2');
    if (savedV2) {
      try {
        const customs = JSON.parse(savedV2) as { name: string; color?: string }[];
        customs.forEach(c => {
          rows.push({ category_name: c.name, color: c.color || null, is_custom: true });
        });
      } catch { /* ignore */ }
    }

    // Migrate color overrides for default categories
    const colorOverrides = JSON.parse(localStorage.getItem('grosafe_category_colors') || '{}');
    Object.entries(colorOverrides).forEach(([name, color]) => {
      if (!rows.find(r => r.category_name === name)) {
        rows.push({ category_name: name, color: color as string, is_custom: false });
      }
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from('category_settings')
        .upsert(rows.map(r => ({
          category_name: r.category_name,
          color: r.color,
          is_custom: r.is_custom,
        })), { onConflict: 'category_name' });

      if (!error) {
        localStorage.setItem('grosafe_categories_migrated_to_db', 'true');
      }
    } else {
      localStorage.setItem('grosafe_categories_migrated_to_db', 'true');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await migrateLocalStorage();
      await fetchCategorySettings();
    };
    init();
  }, [migrateLocalStorage, fetchCategorySettings]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('category_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category_settings' }, () => {
        fetchCategorySettings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCategorySettings]);

  // Derive custom category names from DB
  const customCategoryNames = useMemo(() =>
    categorySettings.filter(s => s.is_custom).map(s => s.category_name),
    [categorySettings]
  );

  // Combine default and custom categories
  const MAIN_CATEGORIES = useMemo(() => {
    return [...DEFAULT_CATEGORIES, ...customCategoryNames];
  }, [customCategoryNames]);

  // Get color for a category from DB settings
  const getCategoryDisplayColor = useCallback((categoryName: string): string | undefined => {
    const setting = categorySettings.find(s => s.category_name === categoryName);
    return setting?.color || undefined;
  }, [categorySettings]);

  // Fetch category counts from product_groups table
  const fetchCategoryCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const counts = await getProductGroupCountsByCategory();
      
      const countMap: Record<string, number> = {};
      MAIN_CATEGORIES.forEach(cat => {
        countMap[cat] = 0;
      });
      
      let uncategorized = 0;
      
      Object.entries(counts).forEach(([category, count]) => {
        if (!category || category === 'Non catégorisé') {
          uncategorized += count;
          return;
        }
        
        const matchedCategory = MAIN_CATEGORIES.find(
          cat => cat.toLowerCase() === category.toLowerCase()
        );
        
        if (matchedCategory) {
          countMap[matchedCategory] += count;
        } else {
          countMap[category] = (countMap[category] || 0) + count;
        }
      });
      
      setUncategorizedCount(uncategorized);
      
      const countArray = Object.entries(countMap).map(([category, count]) => ({
        category,
        count,
      }));
      
      setCategoryCounts(countArray);
    } catch (error) {
      console.error('Error fetching category counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [MAIN_CATEGORIES]);

  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  // Sort categories
  const sortedCategories = useMemo(() => {
    const mainCats = MAIN_CATEGORIES.map(cat => {
      const found = categoryCounts.find(c => c.category.toLowerCase() === cat.toLowerCase());
      return { category: cat, count: found?.count || 0 };
    });

    const otherCats = categoryCounts
      .filter(c => !MAIN_CATEGORIES.some(m => m.toLowerCase() === c.category.toLowerCase()))
      .sort((a, b) => a.category.localeCompare(b.category));

    return [...mainCats, ...otherCats];
  }, [categoryCounts, MAIN_CATEGORIES]);

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

    await fetchCategorySettings();
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
    toast.success(`Catégorie "${newCategoryName.trim()}" ajoutée`);
  }, [newCategoryName, MAIN_CATEGORIES, fetchCategorySettings]);

  const handleEditCategory = useCallback((categoryName: string) => {
    const categoryData = categoryCounts.find(c => c.category === categoryName);
    setEditingCategory(categoryName);
    setEditingCategoryCount(categoryData?.count || 0);
  }, [categoryCounts]);

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
    
    await fetchCategorySettings();
    fetchCategoryCounts();
  }, [editingCategory, editingCategoryCount, customCategoryNames, fetchCategoryCounts, fetchCategorySettings]);

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

    await fetchCategorySettings();
    toast.success(`Catégorie "${editingCategory}" supprimée`);
  }, [editingCategory, editingCategoryCount, customCategoryNames, fetchCategorySettings]);

  const handleDirectDeleteCategory = useCallback((categoryName: string) => {
    const categoryData = categoryCounts.find(c => c.category === categoryName);
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
  }, [categoryCounts, customCategoryNames]);

  const totalProducts = useMemo(() => {
    return categoryCounts.reduce((sum, c) => sum + c.count, 0) + uncategorizedCount;
  }, [categoryCounts, uncategorizedCount]);

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCategoryCounts} disabled={isLoading}>
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
            {sortedCategories.map(({ category, count }) => {
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
            
            {uncategorizedCount > 0 && (
              <CategoryCard
                name="Non catégorisé"
                count={uncategorizedCount}
                onClick={() => handleCategoryClick('Non catégorisé')}
              />
            )}
          </div>

          {/* Empty State */}
          {sortedCategories.every(c => c.count === 0) && uncategorizedCount === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Aucun produit</h3>
              <p className="text-muted-foreground">
                Commencez par ajouter des produits à votre inventaire.
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

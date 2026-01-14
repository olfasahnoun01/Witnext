import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryCard } from './inventory/CategoryCard';
import { ProductGroupView } from './inventory/ProductGroupView';
import { getProductGroupCountsByCategory } from '@/services/productGroupService';
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

export const Inventory = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('grosafe_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Combine default and custom categories
  const MAIN_CATEGORIES = useMemo(() => {
    return [...DEFAULT_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Fetch category counts from product_groups table
  const fetchCategoryCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const counts = await getProductGroupCountsByCategory();
      
      // Initialize main categories
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
        
        // Check if it matches any main category (case-insensitive)
        const matchedCategory = MAIN_CATEGORIES.find(
          cat => cat.toLowerCase() === category.toLowerCase()
        );
        
        if (matchedCategory) {
          countMap[matchedCategory] += count;
        } else {
          // Add as its own category
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

  // Sort categories: main categories first in order, then others alphabetically
  const sortedCategories = useMemo(() => {
    const mainCats = MAIN_CATEGORIES.map(cat => {
      const found = categoryCounts.find(c => c.category.toLowerCase() === cat.toLowerCase());
      return { category: cat, count: found?.count || 0 };
    });

    // Find other categories not in main list
    const otherCats = categoryCounts
      .filter(c => !MAIN_CATEGORIES.some(m => m.toLowerCase() === c.category.toLowerCase()))
      .sort((a, b) => a.category.localeCompare(b.category));

    return [...mainCats, ...otherCats];
  }, [categoryCounts, MAIN_CATEGORIES]);

  const handleAddCategory = useCallback(() => {
    if (!newCategoryName.trim()) return;
    
    // Check if category already exists
    const exists = MAIN_CATEGORIES.some(
      cat => cat.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    
    if (exists) {
      return;
    }
    
    const updatedCategories = [...customCategories, newCategoryName.trim()];
    setCustomCategories(updatedCategories);
    localStorage.setItem('grosafe_custom_categories', JSON.stringify(updatedCategories));
    setNewCategoryName('');
    setIsAddCategoryOpen(false);
  }, [newCategoryName, customCategories, MAIN_CATEGORIES]);

  const totalProducts = useMemo(() => {
    return categoryCounts.reduce((sum, c) => sum + c.count, 0) + uncategorizedCount;
  }, [categoryCounts, uncategorizedCount]);

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
    fetchCategoryCounts(); // Refresh counts when returning
  }, [fetchCategoryCounts]);

  // Show product group view if a category is selected
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
          <Button onClick={() => setIsAddCategoryOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Catégorie
          </Button>
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
            {sortedCategories.map(({ category, count }) => (
              <CategoryCard
                key={category}
                name={category}
                count={count}
                onClick={() => handleCategoryClick(category)}
              />
            ))}
            
            {/* Uncategorized Card */}
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
    </div>
  );
};

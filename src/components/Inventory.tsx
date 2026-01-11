import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CategoryCard } from './inventory/CategoryCard';
import { CategoryView } from './inventory/CategoryView';

// Fixed list of main categories
const MAIN_CATEGORIES = [
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

  // Fetch category counts only (not full product data)
  const fetchCategoryCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get all products with just category field for counting
      const { data, error } = await supabase
        .from('products')
        .select('category');

      if (error) throw error;

      // Count by category
      const counts: Record<string, number> = {};
      let uncategorized = 0;

      MAIN_CATEGORIES.forEach(cat => {
        counts[cat] = 0;
      });

      data?.forEach(product => {
        const productCategory = product.category?.trim();
        
        if (!productCategory) {
          uncategorized++;
          return;
        }

        // Check if it matches any main category (case-insensitive)
        const matchedCategory = MAIN_CATEGORIES.find(
          cat => cat.toLowerCase() === productCategory.toLowerCase()
        );

        if (matchedCategory) {
          counts[matchedCategory]++;
        } else {
          // Product has a category but doesn't match main categories
          // Count it as its own category or add to uncategorized
          if (counts[productCategory]) {
            counts[productCategory]++;
          } else {
            counts[productCategory] = 1;
          }
        }
      });

      setUncategorizedCount(uncategorized);

      // Convert to array format
      const countArray = Object.entries(counts).map(([category, count]) => ({
        category,
        count,
      }));

      setCategoryCounts(countArray);
    } catch (error) {
      console.error('Error fetching category counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [categoryCounts]);

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

  // Show category view if a category is selected
  if (selectedCategory) {
    return <CategoryView category={selectedCategory} onBack={handleBack} />;
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
            {totalProducts} article{totalProducts !== 1 ? 's' : ''} au total
          </p>
        </div>
        <Button variant="outline" onClick={fetchCategoryCounts} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
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
    </div>
  );
};

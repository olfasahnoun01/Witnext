import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProductGroupCountsByCategory } from '@/services/productGroupService';
import { DEFAULT_INVENTORY_CATEGORIES } from '@/constants/inventoryCategories';

export interface CategoryCount {
  category: string;
  count: number;
}

export interface CategorySettingRow {
  id: number;
  category_name: string;
  color: string | null;
  is_custom: boolean;
}

export function useProductGroupCategoryStats() {
  const [categorySettings, setCategorySettings] = useState<CategorySettingRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const migrateLocalStorage = useCallback(async () => {
    const migrated = localStorage.getItem('grosafe_categories_migrated_to_db');
    if (migrated) return;

    const rows: { category_name: string; color: string | null; is_custom: boolean }[] = [];

    const savedV2 = localStorage.getItem('grosafe_custom_categories_v2');
    if (savedV2) {
      try {
        const customs = JSON.parse(savedV2) as { name: string; color?: string }[];
        customs.forEach((c) => {
          rows.push({ category_name: c.name, color: c.color || null, is_custom: true });
        });
      } catch {
        /* ignore */
      }
    }

    const colorOverrides = JSON.parse(localStorage.getItem('grosafe_category_colors') || '{}');
    Object.entries(colorOverrides).forEach(([name, color]) => {
      if (!rows.find((r) => r.category_name === name)) {
        rows.push({ category_name: name, color: color as string, is_custom: false });
      }
    });

    if (rows.length > 0) {
      const { error } = await supabase.from('category_settings').upsert(
        rows.map((r) => ({
          category_name: r.category_name,
          color: r.color,
          is_custom: r.is_custom,
        })),
        { onConflict: 'category_name' }
      );

      if (!error) {
        localStorage.setItem('grosafe_categories_migrated_to_db', 'true');
      }
    } else {
      localStorage.setItem('grosafe_categories_migrated_to_db', 'true');
    }
  }, []);

  const fetchCategorySettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('category_settings')
      .select('id, category_name, color, is_custom');

    if (!error && data) {
      setCategorySettings(data as CategorySettingRow[]);
    }
  }, []);

  const customCategoryNames = useMemo(
    () => categorySettings.filter((s) => s.is_custom).map((s) => s.category_name),
    [categorySettings]
  );

  const MAIN_CATEGORIES = useMemo(
    () => [...DEFAULT_INVENTORY_CATEGORIES, ...customCategoryNames],
    [customCategoryNames]
  );

  const fetchCategoryCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const counts = await getProductGroupCountsByCategory();

      const countMap: Record<string, number> = {};
      MAIN_CATEGORIES.forEach((cat) => {
        countMap[cat] = 0;
      });

      let uncategorized = 0;

      Object.entries(counts).forEach(([category, count]) => {
        if (!category || category === 'Non catégorisé') {
          uncategorized += count;
          return;
        }

        const matchedCategory = MAIN_CATEGORIES.find((cat) => cat.toLowerCase() === category.toLowerCase());

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
    let cancelled = false;
    (async () => {
      await migrateLocalStorage();
      if (!cancelled) await fetchCategorySettings();
    })();
    return () => {
      cancelled = true;
    };
  }, [migrateLocalStorage, fetchCategorySettings]);

  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  useEffect(() => {
    const channel = supabase
      .channel('category_settings_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category_settings' }, () => {
        fetchCategorySettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategorySettings]);

  useEffect(() => {
    const channel = supabase
      .channel('product_groups_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_groups' }, () => {
        fetchCategoryCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategoryCounts]);

  const sortedCategories = useMemo(() => {
    const mainCats = MAIN_CATEGORIES.map((cat) => {
      const found = categoryCounts.find((c) => c.category.toLowerCase() === cat.toLowerCase());
      return { category: cat, count: found?.count || 0 };
    });

    const otherCats = categoryCounts
      .filter((c) => !MAIN_CATEGORIES.some((m) => m.toLowerCase() === c.category.toLowerCase()))
      .sort((a, b) => a.category.localeCompare(b.category));

    return [...mainCats, ...otherCats];
  }, [categoryCounts, MAIN_CATEGORIES]);

  const inventoryChartBarRows = useMemo(() => {
    const rows = sortedCategories
      .filter((c) => c.count > 0)
      .map((c) => ({
        name: c.category.length > 20 ? `${c.category.slice(0, 20)}…` : c.category,
        fullName: c.category,
        count: c.count,
      }));
    if (uncategorizedCount > 0) {
      rows.push({ name: 'Non catégorisé', fullName: 'Non catégorisé', count: uncategorizedCount });
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, 16);
  }, [sortedCategories, uncategorizedCount]);

  const inventoryChartPieRows = useMemo(() => {
    const rows = sortedCategories
      .filter((c) => c.count > 0)
      .map((c) => ({ name: c.category, value: c.count }));
    if (uncategorizedCount > 0) {
      rows.push({ name: 'Non catégorisé', value: uncategorizedCount });
    }
    rows.sort((a, b) => b.value - a.value);
    if (rows.length <= 10) return rows;
    const top = rows.slice(0, 9);
    const otherSum = rows.slice(9).reduce((s, r) => s + r.value, 0);
    return [...top, { name: 'Autres', value: otherSum }];
  }, [sortedCategories, uncategorizedCount]);

  const totalProducts = useMemo(
    () => categoryCounts.reduce((sum, c) => sum + c.count, 0) + uncategorizedCount,
    [categoryCounts, uncategorizedCount]
  );

  const getCategoryDisplayColor = useCallback(
    (categoryName: string): string | undefined => {
      const setting = categorySettings.find((s) => s.category_name === categoryName);
      return setting?.color || undefined;
    },
    [categorySettings]
  );

  const refreshCounts = useCallback(() => fetchCategoryCounts(), [fetchCategoryCounts]);

  const refresh = useCallback(async () => {
    await fetchCategorySettings();
    await fetchCategoryCounts();
  }, [fetchCategorySettings, fetchCategoryCounts]);

  return {
    isLoading,
    categorySettings,
    categoryCounts,
    sortedCategories,
    uncategorizedCount,
    totalProducts,
    customCategoryNames,
    MAIN_CATEGORIES,
    inventoryChartBarRows,
    inventoryChartPieRows,
    getCategoryDisplayColor,
    refresh,
    refreshCounts,
  };
}

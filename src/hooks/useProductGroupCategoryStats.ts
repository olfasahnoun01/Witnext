import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getProductGroupCountsByCategory } from '@/services/productGroupService';
import { waitForSupabaseSession } from '@/lib/waitForSupabaseSession';
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
  const { user, isLoading: authLoading } = useAuth();
  const [categorySettings, setCategorySettings] = useState<CategorySettingRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const mainCategoriesRef = useRef<string[]>([...DEFAULT_INVENTORY_CATEGORIES]);
  const hasLoadedCountsRef = useRef(false);
  const countsFetchInFlightRef = useRef(false);
  const prevMainCategoriesKeyRef = useRef('');
  const fetchGenRef = useRef(0);

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
      setCategorySettings((prev) => {
        const prevKey = JSON.stringify(prev);
        const nextKey = JSON.stringify(data);
        return prevKey === nextKey ? prev : (data as CategorySettingRow[]);
      });
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

  useEffect(() => {
    mainCategoriesRef.current = MAIN_CATEGORIES;
  }, [MAIN_CATEGORIES]);

  const fetchCategoryCounts = useCallback(async (options?: { showLoading?: boolean }) => {
    const gen = ++fetchGenRef.current;
    if (countsFetchInFlightRef.current) return;
    countsFetchInFlightRef.current = true;

    const showLoading = options?.showLoading ?? !hasLoadedCountsRef.current;
    if (showLoading) setIsLoading(true);

    try {
      const ready = await waitForSupabaseSession();
      if (!ready || gen !== fetchGenRef.current) return;

      const counts = await getProductGroupCountsByCategory();
      if (gen !== fetchGenRef.current) return;
      const categories = mainCategoriesRef.current;

      const countMap: Record<string, number> = {};
      categories.forEach((cat) => {
        countMap[cat] = 0;
      });

      let uncategorized = 0;

      Object.entries(counts).forEach(([category, count]) => {
        if (!category || category === 'Non catégorisé') {
          uncategorized += count;
          return;
        }

        const matchedCategory = categories.find(
          (cat) => cat.toLowerCase() === category.toLowerCase()
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
      hasLoadedCountsRef.current = true;
    } catch (error) {
      console.error('Error fetching category counts:', error);
    } finally {
      countsFetchInFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;
    (async () => {
      const ready = await waitForSupabaseSession();
      if (!ready || cancelled) return;
      await migrateLocalStorage();
      if (!cancelled) await fetchCategorySettings();
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, migrateLocalStorage, fetchCategorySettings]);

  const mainCategoriesKey = MAIN_CATEGORIES.join('|');

  useEffect(() => {
    if (authLoading || !user?.id) return;
    hasLoadedCountsRef.current = false;
    prevMainCategoriesKeyRef.current = '';
    void fetchCategoryCounts({ showLoading: true });
  }, [authLoading, user?.id, fetchCategoryCounts]);

  // Re-aggregate when custom categories arrive (stable deps — no refresh loop)
  useEffect(() => {
    if (authLoading || !user?.id || !hasLoadedCountsRef.current) return;
    if (prevMainCategoriesKeyRef.current === mainCategoriesKey) return;
    prevMainCategoriesKeyRef.current = mainCategoriesKey;
    if (mainCategoriesKey === DEFAULT_INVENTORY_CATEGORIES.join('|')) return;
    void fetchCategoryCounts({ showLoading: false });
  }, [authLoading, user?.id, mainCategoriesKey, fetchCategoryCounts]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const channel = supabase
      .channel(`category_settings_stats_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category_settings' }, () => {
        void fetchCategorySettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, fetchCategorySettings]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const channel = supabase
      .channel(`product_groups_stats_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_groups' }, () => {
        void fetchCategoryCounts({ showLoading: false });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, fetchCategoryCounts]);

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

  const refreshCounts = useCallback(
    () => fetchCategoryCounts({ showLoading: false }),
    [fetchCategoryCounts]
  );

  const refresh = useCallback(async () => {
    await fetchCategorySettings();
    await fetchCategoryCounts({ showLoading: false });
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

import { supabase } from '@/integrations/supabase/client';

/** Aligné sur DevisForm + ProductGroupModal (inventaire / groupes). */
const DEFAULT_INVENTORY_CATEGORIES = [
  'Pantalons',
  'Blousons',
  'Bordequin',
  'Accessoires',
  'Gants',
  'Casques',
  'Gilets',
  'Polos & T-shirts',
  'Parkas et manteaux',
  'Non catégorisé',
  'Tablier',
];

/**
 * Tous les noms de catégories utilisés côté inventaire (réglages + produits + groupes + défauts).
 */
export async function fetchInventoryCategoryNames(): Promise<string[]> {
  const allCats = new Set<string>(DEFAULT_INVENTORY_CATEGORIES);
  const [catSettingsRes, productsCatsRes, groupCatsRes] = await Promise.all([
    supabase.from('category_settings').select('category_name'),
    supabase.from('products').select('category'),
    supabase.from('product_groups').select('category'),
  ]);
  (catSettingsRes.data || []).forEach((row: { category_name: string | null }) => {
    if (row.category_name?.trim()) allCats.add(row.category_name.trim());
  });
  (productsCatsRes.data || []).forEach((row: { category: string | null }) => {
    if (row.category?.trim()) allCats.add(row.category.trim());
  });
  (groupCatsRes.data || []).forEach((row: { category: string | null }) => {
    if (row.category?.trim()) allCats.add(row.category.trim());
  });
  return [...allCats].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

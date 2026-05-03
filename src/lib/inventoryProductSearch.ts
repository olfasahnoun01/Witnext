import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';

const SELECT_LIGHT =
  'id, name, sku, category, fournisseur, size, color, price, prix_ttc, remise, quantity, min_stock, product_group_id';

type ProductRow = {
  id: number;
  name: string;
  sku: string;
  category: string;
  fournisseur: string | null;
  size: string | null;
  color: string | null;
  price: number;
  prix_ttc: number | null;
  remise: number | null;
  quantity: number;
  min_stock: number | null;
  product_group_id: number | null;
};

export interface SearchInventoryProductsOptions {
  /** Trimmed search string; empty returns []. */
  searchTerm: string;
  /** Max rows per branch (name / sku); merged list is de-duplicated by id. */
  perBranchLimit?: number;
  /** Max combined results after merge (default 150). */
  maxResults?: number;
  /** Devis achat: restrict variants to this fournisseur (exact match on products.fournisseur). */
  fournisseurExact?: string | null;
}

/**
 * Search inventory variants by substring in name OR sku (case-insensitive).
 * Uses two queries merged by id so we avoid PostgREST `.or()` escaping edge cases
 * and we are not limited to "name starts with…" only.
 */
export async function searchInventoryProductsLight(
  opts: SearchInventoryProductsOptions
): Promise<ProductRow[]> {
  const term = opts.searchTerm.trim();
  if (!term) return [];

  const perBranch = Math.min(Math.max(opts.perBranchLimit ?? 100, 1), 500);
  const maxResults = Math.min(Math.max(opts.maxResults ?? 150, 1), 500);
  const pattern = `%${term}%`;

  let qName = supabase.from('products').select(SELECT_LIGHT).ilike('name', pattern).order('name').limit(perBranch);
  let qSku = supabase.from('products').select(SELECT_LIGHT).ilike('sku', pattern).order('name').limit(perBranch);

  const f = opts.fournisseurExact?.trim();
  if (f) {
    qName = qName.eq('fournisseur', f);
    qSku = qSku.eq('fournisseur', f);
  }

  const [{ data: byName, error: errName }, { data: bySku, error: errSku }] = await Promise.all([qName, qSku]);

  if (errName) console.warn('[searchInventoryProductsLight] name query:', errName.message);
  if (errSku) console.warn('[searchInventoryProductsLight] sku query:', errSku.message);

  const merged = new Map<number, ProductRow>();
  for (const row of [...(byName || []), ...(bySku || [])] as ProductRow[]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  return Array.from(merged.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    .slice(0, maxResults);
}

/** Map DB row to Product shape used by devis dialogs (no image / fiche payload). */
export function mapLightRowToProduct(p: ProductRow): Product {
  const remise = p.remise || 0;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    image: null,
    fiche_technique_url: null,
    fournisseur: p.fournisseur || '',
    size: p.size || '',
    remise,
    prix_ttc: p.prix_ttc ?? p.price * (1 - remise / 100),
    color: p.color || null,
    quantity: p.quantity,
    price: Number(p.price),
    min_stock: p.min_stock ?? 0,
    product_group_id: p.product_group_id,
  };
}

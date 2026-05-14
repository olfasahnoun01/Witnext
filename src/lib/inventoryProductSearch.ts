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
  /** Résolu via product_group_fournisseurs (batch) */
  prix_achat_ht?: number;
};

/** Choisit le PU achat HT parmi les lignes fournisseur du groupe (match nom sinon prix mini). */
export function pickPrixAchatHtFromFournisseurRows(
  rows: { prix_ttc: number | string | null; fournisseur_name?: string | null }[],
  fournisseur: string | null | undefined
): number | undefined {
  if (!rows.length) return undefined;
  const fourn = (fournisseur || '').trim().toLowerCase();
  const match = rows.find(r => String(r.fournisseur_name || '').trim().toLowerCase() === fourn);
  const row = match ?? rows.reduce((a, b) => (Number(a.prix_ttc) <= Number(b.prix_ttc) ? a : b));
  const n = Number(row.prix_ttc);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * PA HT saisi sur la variante inventaire (`products.price`, colonne « Prix HT » / « Prix »).
 * Utilisé quand il n’y a pas (encore) de lignes dans `product_group_fournisseurs`.
 */
export function prixAchatHtFromVariantProduct(price: unknown): number | undefined {
  const p = Number(price);
  return Number.isFinite(p) && p > 0 ? p : undefined;
}

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
  const rowsPre = Array.from(merged.values());

  const explicitGroupIds = [
    ...new Set(rowsPre.map(r => r.product_group_id).filter((id): id is number => id != null)),
  ];
  const orphanNames = [
    ...new Set(rowsPre.filter(r => r.product_group_id == null && r.name?.trim()).map(r => r.name)),
  ] as string[];

  const nameToGroupId = new Map<string, number>();
  if (orphanNames.length) {
    const { data: grs, error: gErr } = await supabase.from('product_groups').select('id, name').in('name', orphanNames);
    if (gErr) console.warn('[searchInventoryProductsLight] groups by name:', gErr.message);
    for (const g of grs || []) {
      if (g?.name != null && !nameToGroupId.has(g.name)) nameToGroupId.set(g.name, g.id);
    }
  }

  const implicitGroupIds = [
    ...new Set(
      rowsPre
        .map(r => (r.product_group_id == null ? nameToGroupId.get(r.name) : null))
        .filter((id): id is number => id != null)
    ),
  ];
  const allGroupIds = [...new Set([...explicitGroupIds, ...implicitGroupIds])];

  const byGroup = new Map<number, { prix_ttc: number; fournisseur_name: string }[]>();
  if (allGroupIds.length) {
    const { data: fRows, error: fErr } = await supabase
      .from('product_group_fournisseurs')
      .select('product_group_id, prix_ttc, fournisseur_name')
      .in('product_group_id', allGroupIds);
    if (fErr) console.warn('[searchInventoryProductsLight] fournisseurs:', fErr.message);
    for (const fr of fRows || []) {
      const gid = fr.product_group_id;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(fr as { prix_ttc: number; fournisseur_name: string });
    }
  }

  return rowsPre
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    .slice(0, maxResults)
    .map(r => {
      const gid = r.product_group_id ?? nameToGroupId.get(r.name) ?? null;
      const rowsForG = gid != null ? byGroup.get(gid) || [] : [];
      const fromSuppliers =
        rowsForG.length > 0 ? pickPrixAchatHtFromFournisseurRows(rowsForG, r.fournisseur) : undefined;
      const picked = fromSuppliers ?? prixAchatHtFromVariantProduct(r.price);
      if (picked === undefined) return r;
      return { ...r, prix_achat_ht: picked };
    });
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
    ...(p.prix_achat_ht !== undefined ? { prix_achat_ht: p.prix_achat_ht } : {}),
  };
}

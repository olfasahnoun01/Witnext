import type { Product } from '@/types';

/** Lightweight product columns (no image blob). */
export const PRODUCT_COLUMNS_LIGHT =
  'id,name,sku,category,fournisseur,size,color,quantity,price,remise,prix_ttc,min_stock,product_group_id,subject_to_fodec' as const;

export type ProductRowLight = {
  id: number;
  name: string;
  sku: string;
  category: string;
  fournisseur: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  price: number;
  prix_ttc: number | null;
  remise: number | null;
  min_stock: number;
  product_group_id: number | null;
  subject_to_fodec?: boolean | null;
  image?: string | null;
};

export function mapProductRow(p: ProductRowLight, includeImage = false): Product {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    fournisseur: p.fournisseur || '',
    size: p.size || '',
    quantity: p.quantity,
    price: Number(p.price),
    remise: Number(p.remise) || 0,
    prix_ttc: Number(p.prix_ttc) || Number(p.price),
    min_stock: p.min_stock,
    image: includeImage ? (p.image || null) : null,
    color: p.color || null,
    product_group_id: p.product_group_id,
    subject_to_fodec: Boolean(p.subject_to_fodec),
  };
}

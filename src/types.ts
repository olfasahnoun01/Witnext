export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  fournisseur: string;
  size: string;
  quantity: number;
  price: number;
  remise: number;
  prix_ttc: number;
  min_stock: number;
  image: string | null;
  color: string | null;
  product_group_id?: number | null;
}

export interface ProductGroupFournisseur {
  id?: number;
  product_group_id?: number;
  fournisseur_name: string;
  prix_ttc: number;
}

export interface ProductGroup {
  id: number;
  name: string;
  category: string;
  base_sku: string | null;
  fournisseur: string | null;
  image: string | null;
  min_stock: number;
  created_at: string;
  updated_at: string;
  // Computed fields from variants
  variant_count?: number;
  total_stock?: number;
  colors?: string[];
  sizes?: string[];
  // Multi-suppliers
  fournisseurs?: ProductGroupFournisseur[];
}

export interface Transaction {
  id: number;
  product_id: number;
  product_name: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  date: string;
  note: string;
}

export interface DocumentItem {
  ref: string;
  designation: string;
  description: string;
  quantity: number;
  price?: number;
  product_id?: number;
}

export interface DocumentData {
  type: 'bon_livraison' | 'bon_sortie' | 'bon_entree';
  number: string;
  date: string;
  validity: string;
  transportRef: string;
  thirdParty: {
    name: string;
    address: string;
    taxId: string;
  };
  items: DocumentItem[];
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface CategoryValue {
  category: string;
  value: number;
}

export interface DashboardStats {
  totalValue: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryValues: CategoryValue[];
}

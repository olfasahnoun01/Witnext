export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  fournisseur: string;
  size: string;
  quantity: number;
  price: number;
  min_stock: number;
  image: string | null;
  color: string | null;
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

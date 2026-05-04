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
  fiche_technique_url?: string | null;
  /** When this product row (variant) was created */
  created_at?: string | null;
}

export interface ProductGroupFournisseur {
  id?: number;
  product_group_id?: number;
  fournisseur_name: string;
  prix: number;
  remise: number;
  prix_ttc: number;
  fiche_technique_url?: string | null;
  phone?: string | null;
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
  variant_count?: number;
  total_stock?: number;
  colors?: string[];
  sizes?: string[];
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
  actual_deducted?: number;
  line_id?: string;
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

// Devis types
export interface DevisItem {
  designation: string;
  fournisseur: string;
  prix_ttc: number;
  remise: number;
  quantity: number;
  description?: string;
  prix_achat?: number;
  tva?: number; // 7, 13, or 19 (default 19)
  product_id?: number;
  line_id?: string;
}

export interface Devis {
  id: number;
  type: 'entrant' | 'sortant' | 'achat' | 'vente';
  devis_number: string;
  devis_date: string;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  items: DevisItem[];
  total_amount: number;
  notes: string | null;
  status: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'confirmé' | 'reçu' | 'intégré';
  is_ttc: boolean;
  is_bc: boolean;
  is_ba: boolean;
  source_devis_id: number | null;
  created_by: string | null;
  creator_name?: string | null;
  source_devis_number?: string | null;
  created_at: string;
  updated_at: string;
}

// BonCommande is just a Devis with is_bc = true
export type BonCommande = Devis;

export interface Facture {
  id: string; // UUID
  numero: string;
  type: 'vente' | 'achat';
  date_creation: string;
  date_echeance: string | null;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  items: DevisItem[];
  total_amount: number;
  status: 'brouillon' | 'envoyée' | 'payée' | 'retard' | 'annulée';
  is_ttc: boolean;
  source_bc_id: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Unified Document Engine (v2) ---

export type UnifiedDocumentType = 
  | 'DEMANDE_ACHAT'
  | 'BC_CLIENT' 
  | 'DEVIS_FOURNISSEUR' 
  | 'BC_FOURNISSEUR' 
  | 'BL_FOURNISSEUR' 
  | 'BE' 
  | 'BS' 
  | 'BL_CLIENT' 
  | 'FACTURE';

export type UnifiedDocumentStatus = 
  | 'DRAFT' 
  | 'PENDING' 
  | 'VALIDATED' 
  | 'COMPLETED' 
  | 'REJECTED'
  | 'PARTIALLY_RECEIVED';

export interface UnifiedDocumentLine {
  id: string; // UUID
  document_id: string;
  product_id: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  description?: string;
  created_at: string;
  updated_at: string;
  
  // Flattened product info for display
  product_name?: string;
  product_sku?: string;
}

export interface UnifiedDocument {
  id: string; // UUID
  numero: string;
  type: UnifiedDocumentType;
  status: UnifiedDocumentStatus;
  client_id: number | null;
  fournisseur_id: number | null;
  parent_id: string | null; // UUID parent
  notes: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  lines?: UnifiedDocumentLine[];
  client_name?: string;
  fournisseur_name?: string;
}

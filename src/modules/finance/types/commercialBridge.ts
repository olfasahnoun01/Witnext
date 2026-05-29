import type { VatRate } from '../types';

/** Pièce commerciale legacy (table `devis`). */
export type CommercialDevisKind = 'devis' | 'bc' | 'ba';

export interface CommercialDevisRow {
  id: number;
  kind: CommercialDevisKind;
  flow: 'vente' | 'achat';
  numero: string;
  date: string;
  thirdPartyName: string | null;
  thirdPartyTaxId: string | null;
  status: string;
  totalAmount: number;
  lineCount: number;
  sourceDevisId: number | null;
}

/** Pièce magasin unifiée (table `documents`). */
export type WarehouseDocType =
  | 'BC_CLIENT'
  | 'BC_FOURNISSEUR'
  | 'BL_CLIENT'
  | 'BL_FOURNISSEUR'
  | 'BE'
  | 'BS'
  | 'FACTURE';

export interface WarehouseDocumentRow {
  id: string;
  type: WarehouseDocType;
  numero: string;
  status: string;
  createdAt: string;
  thirdPartyName: string | null;
  thirdPartyTaxId: string | null;
  clientId: number | null;
  fournisseurId: number | null;
  lineCount: number;
  totalHt: number;
}

/** Référence tiers pour consultation Finance. */
export interface TierDirectoryRow {
  id: number;
  nom: string;
  matriculeFiscale: string | null;
  location: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Traçabilité vers modules Ventes / Magasin (stockée dans invoices.metadata). */
export interface FinanceSourceRef {
  module: 'devis' | 'documents';
  doc_kind: string;
  source_id: string;
  source_numero: string;
  counterparty_id?: number | null;
}

/** Brouillon de facture pré-rempli depuis une pièce commerciale. */
export interface CommercialInvoiceDraft {
  invoiceType: 'vente' | 'achat';
  numero: string;
  counterpart_name: string;
  counterpart_tax_id?: string | null;
  issue_date: string;
  notes?: string | null;
  apply_timbre_fiscal: boolean;
  lines: Array<{
    product_code?: string | null;
    description: string;
    quantity: number;
    unit_price_ht: number;
    vat_rate: VatRate;
    subject_to_fodec?: boolean;
  }>;
  source_ref: FinanceSourceRef;
}

export const WAREHOUSE_DOC_LABELS: Record<WarehouseDocType, string> = {
  BC_CLIENT: 'BC client',
  BC_FOURNISSEUR: 'BC fournisseur',
  BL_CLIENT: 'BL client (bon de livraison)',
  BL_FOURNISSEUR: 'BL fournisseur (réception)',
  BE: 'BE — bon d\'entrée magasin',
  BS: 'BS — bon de sortie magasin',
  FACTURE: 'Facture commerciale (v2)',
};

export const DEVIS_KIND_LABELS: Record<CommercialDevisKind, string> = {
  devis: 'Devis',
  bc: 'Bon de commande',
  ba: 'Bon d\'achat',
};

import type { Json } from '@/integrations/supabase/types';

export type CompanyCode = 'grosafe' | 'granisafe' | 'safe_team';

export interface FinanceCompanyRow {
  id: string;
  code: CompanyCode;
  name: string;
  created_at: string;
  /** Matricule fiscal TEJ (7 chiffres + clé), ex. 0001238L. */
  matricule_fiscal?: string | null;
  /** PM | PP — catégorie déclarant TEJ. */
  categorie_contribuable?: 'PM' | 'PP' | null;
}

export interface FinanceCapabilities {
  /** Achats / factures fournisseurs */
  purchases: boolean;
  /** Paiements sortants fournisseurs */
  supplierPayments: boolean;
  /** Encaissements clients */
  clientPayments: boolean;
  /** Mouvements de tresorerie */
  treasury: boolean;
  /** Declarations TVA + retenue a la source (fournisseur) */
  vatDeclarations: boolean;
  /** Retenue a la source cote fournisseur */
  supplierWithholding: boolean;
  /** Etats financiers */
  statements: boolean;
}

export type FinanceInvoiceType = 'vente' | 'achat';
export type FinanceInvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'void';
export type PaymentDirection = 'inbound_client' | 'outbound_supplier' | 'internal';
export type VatRate = 0 | 7 | 13 | 19;

export interface InvoiceRow {
  id: string;
  company_id: string;
  invoice_type: FinanceInvoiceType;
  numero: string;
  counterpart_name: string | null;
  counterpart_tax_id: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  total_ht: number;
  total_ttc: number;
  vat_amount: number;
  amount_paid: number;
  status: FinanceInvoiceStatus;
  notes: string | null;
  metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  company_id: string;
  payment_date: string;
  amount: number;
  method: string;
  direction: PaymentDirection;
  counterparty_name: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  product_code: string | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: VatRate;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWriteInput {
  company_id: string;
  numero: string;
  counterpart_name: string;
  counterpart_tax_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  notes?: string | null;
  /** Applique le timbre fiscal forfaitaire (1,000 DT) au TTC — usage Tunisie. */
  apply_timbre_fiscal?: boolean;
  lines: Array<{
    product_code?: string | null;
    description: string;
    quantity: number;
    unit_price_ht: number;
    vat_rate: VatRate;
    /** Remise % sur la ligne (0–100). */
    remise_percent?: number;
    /** Ligne soumise FODEC (contribution industrielle) — taux appliqué côté service. */
    subject_to_fodec?: boolean;
  }>;
}

/** @deprecated Utiliser InvoiceWriteInput */
export type SalesInvoiceWriteInput = InvoiceWriteInput;

export type PurchaseInvoiceWriteInput = InvoiceWriteInput;

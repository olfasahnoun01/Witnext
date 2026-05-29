import type { InvoiceRow } from '../types';

/** Modes de règlement affichés dans l'UI (norme tunisienne). */
export type ModeReglement = 'ESPECE' | 'CHEQUE' | 'VIREMENT' | 'TRAITE';

/** Sens du règlement : encaissement client ou décaissement fournisseur. */
export type SettlementDirection = 'client' | 'fournisseur';

/** Cycle de vie d'un effet (traite / chèque différé). */
export type TraiteStatus =
  | 'RECU_EMIS'
  | 'EN_BANQUE'
  | 'VALIDE'
  | 'IMPAYE';

export type TraiteAction = 'REMITTRE_BANQUE' | 'VALIDER_ENCAISSEMENT' | 'DECLARER_IMPAYE';

/** Métadonnées sérialisées dans payments.notes (JSON). */
export interface PaymentFinanceMeta {
  v: 1;
  modeReglement: ModeReglement;
  numeroPiece: string;
  pieceNumero?: string | null;
  banque?: string | null;
  dateEcheance?: string | null;
  traitStatus?: TraiteStatus | null;
  counterpartyId?: number | null;
  counterpartyType?: 'client' | 'fournisseur';
  withholdingAmount?: number;
  withholdingRate?: number;
  treasuryAccountId?: string;
}

export interface CounterpartyOption {
  id: number;
  label: string;
  raisonSociale: string;
  matriculeFiscal: string | null;
  adresse?: string | null;
}

export interface InvoiceLetterageRow {
  invoice: InvoiceRow;
  montantInitialTtc: number;
  resteAPayer: number;
  montantAImputer: number;
  selected: boolean;
}

export interface SettlementTotals {
  montantTotalSaisi: number;
  montantAffecte: number;
  montantRestant: number;
  retenueSource: number;
  montantNetApresRs: number;
  retenueApplicable: boolean;
}

export interface WithholdingLineInput {
  invoiceId: string;
  numeroFacture: string;
  montantTtc: number;
  taux: number;
}

export interface WithholdingLineResult extends WithholdingLineInput {
  assiette: number;
  montantRetenue: number;
}

export interface TraitePortfolioItem {
  paymentId: string;
  referencePiece: string;
  tiers: string;
  typeTiers: 'Client' | 'Fournisseur';
  mode: ModeReglement;
  banque: string | null;
  dateEcheance: string | null;
  montant: number;
  statut: TraiteStatus;
  paymentDate: string;
}

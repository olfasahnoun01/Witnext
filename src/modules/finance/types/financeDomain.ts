/**
 * Types du module Finance — Trésorerie, Règlements, Avoirs, TVA (Tunisie).
 * Aucune dépendance SQL : structures utilisées par l'UI et les services TypeScript.
 */

import type { InvoiceRow } from '../types';
import type { ModeReglement, SettlementDirection, TraiteStatus } from './paymentTypes';

/** Taux TVA légaux en Tunisie. */
export type TauxTvaTunisie = 0 | 7 | 13 | 19;

/** Type de compte de trésorerie. */
export type TreasuryAccountType = 'BANQUE' | 'CAISSE' | 'ATTENTE_EFFETS';

/** Compte bancaire ou caisse paramétré. */
export interface TreasuryAccount {
  id: string;
  companyId: string;
  nom: string;
  type: TreasuryAccountType;
  codeComptable: string;
  /** RIB tunisien — 24 chiffres lorsque renseigné. */
  rib: string | null;
  banqueLabel: string | null;
  soldeActuel: number;
  actif: boolean;
  createdAt: string;
}

/** Virement interne entre deux comptes. */
export interface InterAccountTransfer {
  id: string;
  companyId: string;
  compteSourceId: string;
  compteDestinationId: string;
  montant: number;
  dateOperation: string;
  motif: string;
  createdAt: string;
}

/** Identifiant opération TEJ (TEJRSCodesOperations_v1.0). */
export type TejIdTypeOperation = string;

/** Bénéficiaire du certificat — champs exigés par TEJ. */
export interface WithholdingBeneficiaire {
  categorieContribuable: 'PM' | 'PP';
  /** 1 = résident TN, 0 = non-résident. */
  resident: '0' | '1';
  adresse: string;
  activite?: string | null;
  email: string;
  tel: string;
}

/** Ligne d'opération TEJ / certificat. */
export interface WithholdingOperationLine {
  factureNumero: string;
  /** Année de facturation (YYYY). */
  anneeFacturation: string;
  /** Code TEJ IdTypeOperation. */
  idTypeOperation: TejIdTypeOperation;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  /** Assiette de calcul RS conservée pour les contrôles métier (non exportée par le XSD). */
  assiette: number;
  taux: number;
  montantRetenue: number;
  /** Taux TVA appliqué (0 | 7 | 13 | 19…). */
  tauxTva: number;
  /** Convention non double imposition : 0 = droit commun. */
  cnpc?: '0' | '1';
  /** Retenue prise en charge : 0 = non. */
  pCharge?: '0' | '1';
}

/** Certificat de retenue à la source généré à l'enregistrement. */
export interface WithholdingCertificate {
  id: string;
  companyId: string;
  mode: 'PAYEUR' | 'BENEFICIAIRE';
  counterpartyId: number;
  counterpartyName: string;
  matriculeFiscal: string | null;
  paymentId: string | null;
  /** Date paiement YYYY-MM-DD (TEJ DatePayement). */
  paymentDate: string;
  /** Ref_certif_chez_declarant (casse exacte du XSD TEJ). */
  refCertif: string;
  beneficiaire: WithholdingBeneficiaire | null;
  lignes: WithholdingOperationLine[];
  totalRetenue: number;
  createdAt: string;
}

/** Ligne de lettrage : facture ou avoir financier. */
export type LetterageDocumentKind = 'FACTURE' | 'AVOIR';

export interface LetterageLine {
  kind: LetterageDocumentKind;
  id: string;
  numero: string;
  date: string;
  /** TTC facture positive ; avoir en crédit (négatif pour le net). */
  montantTtc: number;
  resteAPayer: number;
  montantAImputer: number;
  selected: boolean;
  invoice?: InvoiceRow;
  avoirId?: string;
}

/** Avoir financier (note de crédit purement financière). */
export type AvoirFinancierType = 'vente' | 'achat';

export type AvoirFinancierStatus = 'brouillon' | 'valide' | 'annule';

export interface AvoirFinancierLine {
  id: string;
  description: string;
  montantHt: number;
  tauxTva: TauxTvaTunisie;
  montantTva: number;
  montantTtc: number;
}

export interface AvoirFinancier {
  id: string;
  companyId: string;
  type: AvoirFinancierType;
  numero: string;
  issueDate: string;
  counterpartyId: number;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  lignes: AvoirFinancierLine[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  /** Crédit restant applicable en lettrage. */
  creditRestant: number;
  status: AvoirFinancierStatus;
  notes: string | null;
  createdAt: string;
}

/** Type de frais bancaire (prédéfini ou personnalisé). */
export interface BankFeeTypeDefinition {
  id: string;
  label: string;
  builtin?: boolean;
}

/** Charge bancaire enregistrée. */
export interface BankFeeCharge {
  id: string;
  companyId: string;
  treasuryAccountId: string;
  treasuryAccountName: string;
  feeTypeId: string;
  feeTypeLabel: string;
  label: string;
  montantHt: number;
  tauxTva: TauxTvaTunisie;
  montantTva: number;
  montantTtc: number;
  dateOperation: string;
  dateEcheance?: string | null;
  status: 'PAYEE' | 'IMPAYEE' | 'EN_COURS';
  notes?: string | null;
  createdAt: string;
}

/** Avoir par article — crédit lié à une facture et ses lignes. */
export type AvoirArticleType = 'vente' | 'achat';

export interface AvoirParArticleLine {
  id: string;
  invoiceLineId: string;
  productCode: string | null;
  description: string;
  quantity: number;
  unitPriceHt: number;
  tauxTva: TauxTvaTunisie;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
}

export interface AvoirParArticle {
  id: string;
  companyId: string;
  type: AvoirArticleType;
  numero: string;
  issueDate: string;
  invoiceId: string;
  invoiceNumero: string;
  counterpartyId: number;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  lignes: AvoirParArticleLine[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  creditRestant: number;
  status: AvoirFinancierStatus;
  notes: string | null;
  createdAt: string;
}

/** Agrégat TVA collectée par taux pour une période. */
export interface VatRateAggregate {
  taux: TauxTvaTunisie;
  totalHt: number;
  totalTva: number;
}

/** Déclaration mensuelle TVA (préparation). */
export interface VatMonthlyDeclaration {
  companyId: string;
  mois: number;
  annee: number;
  collectee: VatRateAggregate[];
  deductibleAchats: VatRateAggregate[];
  deductibleImmobilisations: VatRateAggregate[];
  totalCollectee: number;
  totalDeductible: number;
  /** Positif = à verser ; négatif = crédit. */
  solde: number;
  estCredit: boolean;
}

/** Payload enregistrement règlement (couche service). */
export interface SettlementSubmitPayload {
  companyId: string;
  direction: SettlementDirection;
  treasuryAccountId: string;
  paymentDate: string;
  montantTotal: number;
  mode: ModeReglement;
  pieceNumero?: string;
  banque?: string;
  dateEcheance?: string;
  counterpartyId: number;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  allocations: Array<{ documentId: string; kind: LetterageDocumentKind; amount: number }>;
  withholdingCertificate?: Omit<WithholdingCertificate, 'id' | 'createdAt'>;
  notes?: string;
}

export interface TreasuryMovementRecord {
  id: string;
  companyId: string;
  accountId: string;
  movementDate: string;
  label: string;
  amountSigned: number;
  category: string;
  linkedPaymentId?: string | null;
}

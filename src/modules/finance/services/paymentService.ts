/**
 * Service métier — Règlements, retenue à la source (Tunisie), lettrage et effets (traites).
 * Logique pure (sans accès DB) : testable et réutilisable par l'UI et l'API.
 */

import { SEUIL_RETENUE_SOURCE_TTC, TIMBRE_FISCAL_DT } from '../lib/constants';
import { round3 } from '../lib/money';
import type { FinanceInvoiceStatus, InvoiceRow } from '../types';
import type {
  InvoiceLetterageRow,
  ModeReglement,
  PaymentFinanceMeta,
  SettlementTotals,
  TraiteAction,
  TraiteStatus,
  WithholdingLineInput,
  WithholdingLineResult,
} from '../types/paymentTypes';

const META_PREFIX = '__finance_meta__:';

/** Mappe le mode UI vers la colonne `payments.method` (contrainte Supabase). */
export function mapModeToDbMethod(mode: ModeReglement): 'cash' | 'check' | 'transfer' | 'card' | 'other' {
  switch (mode) {
    case 'ESPECE':
      return 'cash';
    case 'CHEQUE':
      return 'check';
    case 'VIREMENT':
      return 'transfer';
    case 'TRAITE':
      return 'other';
    default:
      return 'other';
  }
}

/** Reste à payer TTC d'une facture Finance. */
export function invoiceOutstandingTtc(invoice: Pick<InvoiceRow, 'total_ttc' | 'amount_paid'>): number {
  return round3(Math.max(0, Number(invoice.total_ttc) - Number(invoice.amount_paid)));
}

/** Construit les lignes de lettrage pour un tiers (factures émises / partielles uniquement). */
export function buildLetterageRows(
  invoices: InvoiceRow[],
  preAllocations?: Record<string, number>
): InvoiceLetterageRow[] {
  return invoices
    .filter((inv) => ['issued', 'partial'].includes(inv.status))
    .map((invoice) => {
      const resteAPayer = invoiceOutstandingTtc(invoice);
      const montantAImputer = preAllocations?.[invoice.id] ?? 0;
      return {
        invoice,
        montantInitialTtc: round3(Number(invoice.total_ttc)),
        resteAPayer,
        montantAImputer: round3(Math.min(montantAImputer, resteAPayer)),
        selected: montantAImputer > 0,
      };
    })
    .filter((row) => row.resteAPayer > 0)
    .sort((a, b) => a.invoice.issue_date.localeCompare(b.invoice.issue_date));
}

/** Totaux pied de formulaire : saisi, affecté, reste, RS. */
export function computeSettlementTotals(
  montantTotalSaisi: number,
  rows: InvoiceLetterageRow[],
  withholdingAmount = 0
): SettlementTotals {
  const montantAffecte = round3(
    rows.filter((r) => r.selected && r.montantAImputer > 0).reduce((s, r) => s + r.montantAImputer, 0)
  );
  const brutImpute = montantAffecte;
  const retenueApplicable = isRetenueSourceObligatoire(brutImpute);
  const retenueSource = retenueApplicable ? round3(withholdingAmount) : 0;
  const montantNetApresRs = round3(Math.max(0, montantTotalSaisi - retenueSource));
  const montantRestant = round3(Math.max(0, montantTotalSaisi - montantAffecte - (retenueApplicable ? 0 : 0)));

  return {
    montantTotalSaisi: round3(montantTotalSaisi),
    montantAffecte,
    montantRestant,
    retenueSource,
    montantNetApresRs,
    retenueApplicable,
  };
}

/** Seuil RS : total brut des factures payées ≥ 1 000,000 DT TTC. */
export function isRetenueSourceObligatoire(totalBrutFacturesPayees: number): boolean {
  return round3(totalBrutFacturesPayees) >= SEUIL_RETENUE_SOURCE_TTC;
}

/**
 * Assiette RS tunisienne : Montant TTC − timbre fiscal (1,000 DT).
 * La retenue ne s'applique pas sur une assiette négative ou nulle.
 */
export function computeAssietteRetenue(montantTtc: number): number {
  return round3(Math.max(0, montantTtc - TIMBRE_FISCAL_DT));
}

/** Calcul ligne certificat / tableau RS. */
export function computeWithholdingLine(line: WithholdingLineInput): WithholdingLineResult {
  const assiette = computeAssietteRetenue(line.montantTtc);
  const montantRetenue = round3(assiette * (line.taux / 100));
  return {
    ...line,
    assiette,
    montantRetenue,
  };
}

/** Agrège la retenue sur plusieurs factures lettrées. */
export function computeTotalWithholding(
  lines: Array<{ montantTtc: number; taux: number }>
): { lines: WithholdingLineResult[]; total: number } {
  const computed = lines.map((l, i) =>
    computeWithholdingLine({
      invoiceId: `line-${i}`,
      numeroFacture: '',
      montantTtc: l.montantTtc,
      taux: l.taux,
    })
  );
  const total = round3(computed.reduce((s, l) => s + l.montantRetenue, 0));
  return { lines: computed, total };
}

/** Nouveau statut facture après imputation. */
export function resolveInvoiceStatusAfterPayment(
  invoice: Pick<InvoiceRow, 'total_ttc' | 'amount_paid'>,
  montantImpute: number
): FinanceInvoiceStatus {
  const newPaid = round3(Number(invoice.amount_paid) + montantImpute);
  const total = Number(invoice.total_ttc);
  if (newPaid >= total) return 'paid';
  if (newPaid > 0) return 'partial';
  return 'issued';
}

/** Un règlement en espèces ne peut pas dépasser le solde caisse disponible. */
export function assertCashBalanceSufficient(soldeCaisse: number, montantDecaissement: number): void {
  if (montantDecaissement <= 0) return;
  if (round3(soldeCaisse) < round3(montantDecaissement)) {
    throw new Error(
      `Solde caisse insuffisant : disponible ${round3(soldeCaisse).toFixed(3)} DT, demandé ${round3(montantDecaissement).toFixed(3)} DT.`
    );
  }
}

/** Valide le lettrage avant enregistrement. */
export function validateSettlementInput(args: {
  montantTotalSaisi: number;
  rows: InvoiceLetterageRow[];
  mode: ModeReglement;
  direction: 'client' | 'fournisseur';
  soldeCaisse?: number;
  pieceNumero?: string;
  banque?: string;
  dateEcheance?: string;
}): { ok: true } | { ok: false; message: string } {
  if (args.montantTotalSaisi <= 0) {
    return { ok: false, message: 'Le montant du règlement doit être strictement positif.' };
  }

  const selected = args.rows.filter((r) => r.selected && r.montantAImputer > 0);
  if (selected.length === 0) {
    return { ok: false, message: 'Sélectionnez au moins une facture et saisissez un montant à imputer.' };
  }

  for (const row of selected) {
    if (row.montantAImputer > row.resteAPayer + 0.0001) {
      return {
        ok: false,
        message: `Montant à imputer supérieur au reste à payer pour la facture ${row.invoice.numero}.`,
      };
    }
  }

  const totalAffecte = round3(selected.reduce((s, r) => s + r.montantAImputer, 0));
  if (totalAffecte > round3(args.montantTotalSaisi) + 0.0001) {
    return {
      ok: false,
      message: 'La somme imputée ne peut pas dépasser le montant total saisi.',
    };
  }

  if (args.mode === 'CHEQUE' || args.mode === 'TRAITE') {
    if (!args.pieceNumero?.trim()) {
      return { ok: false, message: 'Le numéro de pièce est obligatoire pour chèque et traite.' };
    }
    if (!args.banque?.trim()) {
      return { ok: false, message: 'La banque émettrice est obligatoire.' };
    }
    if (!args.dateEcheance?.trim()) {
      return { ok: false, message: "La date d'échéance est obligatoire." };
    }
  }

  if (args.mode === 'ESPECE' && args.direction === 'fournisseur' && args.soldeCaisse != null) {
    try {
      assertCashBalanceSufficient(args.soldeCaisse, args.montantTotalSaisi);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Solde caisse insuffisant.' };
    }
  }

  return { ok: true };
}

/** Les effets différés n'impactent le solde bancaire réel qu'après validation. */
export function shouldPostTreasuryOnSettlement(mode: ModeReglement): boolean {
  return mode === 'ESPECE' || mode === 'VIREMENT';
}

/** Statut initial d'un effet à la saisie du règlement. */
export function initialTraiteStatus(mode: ModeReglement): TraiteStatus | null {
  if (mode === 'CHEQUE' || mode === 'TRAITE') return 'RECU_EMIS';
  return null;
}

/**
 * Machine d'état — Suivi des traites et chèques.
 * RECU_EMIS → EN_BANQUE → VALIDE | IMPAYE
 */
export function transitionTraiteStatus(current: TraiteStatus, action: TraiteAction): TraiteStatus {
  switch (action) {
    case 'REMITTRE_BANQUE':
      if (current === 'RECU_EMIS') return 'EN_BANQUE';
      throw new Error('Remise en banque impossible depuis ce statut.');
    case 'VALIDER_ENCAISSEMENT':
      if (current === 'RECU_EMIS' || current === 'EN_BANQUE') return 'VALIDE';
      throw new Error('Validation impossible : effet déjà soldé ou impayé.');
    case 'DECLARER_IMPAYE':
      if (current === 'VALIDE') {
        throw new Error('Un effet déjà encaissé ne peut être déclaré impayé sans avoirure (contact comptable).');
      }
      if (current === 'IMPAYE') return 'IMPAYE';
      return 'IMPAYE';
    default:
      throw new Error('Action inconnue.');
  }
}

export function traiteStatusLabel(status: TraiteStatus): string {
  const labels: Record<TraiteStatus, string> = {
    RECU_EMIS: 'Reçu / émis',
    EN_BANQUE: 'En cours d\'encaissement',
    VALIDE: 'Encaissé',
    IMPAYE: 'Impayé',
  };
  return labels[status];
}

/** Sérialise les métadonnées finance dans payments.notes. */
export function serializePaymentMeta(meta: PaymentFinanceMeta, userNotes?: string | null): string {
  const payload = `${META_PREFIX}${JSON.stringify(meta)}`;
  if (userNotes?.trim()) return `${payload}\n---\n${userNotes.trim()}`;
  return payload;
}

/** Extrait les métadonnées depuis payments.notes. */
export function parsePaymentMeta(notes: string | null): PaymentFinanceMeta | null {
  if (!notes?.includes(META_PREFIX)) return null;
  const start = notes.indexOf(META_PREFIX) + META_PREFIX.length;
  const end = notes.indexOf('\n---\n', start);
  const jsonStr = end >= 0 ? notes.slice(start, end) : notes.slice(start);
  try {
    const parsed = JSON.parse(jsonStr) as PaymentFinanceMeta;
    if (parsed?.v === 1 && parsed.modeReglement) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** Génère un numéro de pièce de règlement. */
export function generateNumeroPiece(direction: 'client' | 'fournisseur'): string {
  const prefix = direction === 'client' ? 'REG-CLI' : 'REG-FRS';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${stamp}-${seq}`;
}

/** Indique si un impayé doit réouvrir les factures lettrées (montant restant). */
export function computeInvoiceReversalOnImpaye(
  invoice: Pick<InvoiceRow, 'amount_paid' | 'total_ttc'>,
  montantAnnule: number
): { newAmountPaid: number; status: FinanceInvoiceStatus } {
  const newPaid = round3(Math.max(0, Number(invoice.amount_paid) - montantAnnule));
  let status: FinanceInvoiceStatus = 'issued';
  if (newPaid >= Number(invoice.total_ttc)) status = 'paid';
  else if (newPaid > 0) status = 'partial';
  return { newAmountPaid: newPaid, status };
}

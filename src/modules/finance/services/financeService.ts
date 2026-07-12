/**
 * FinanceService — logique métier transversale (Tunisie).
 * Trésorerie, caisse, virements, RS, lettrage auto, validation effets, TVA.
 */

import { SEUIL_RETENUE_SOURCE_TTC, TIMBRE_FISCAL_DT } from '../lib/constants';
import { round3 } from '../lib/money';
import {
  agregerTvaParTaux,
  calculerMontantTva,
  calculerSoldeDeclarationTva,
  calculerTtcDepuisHt,
} from '../lib/vatEngine';
import type { InvoiceRow } from '../types';
import type {
  AvoirFinancier,
  AvoirFinancierLine,
  LetterageLine,
  TreasuryAccount,
  TauxTvaTunisie,
  VatMonthlyDeclaration,
  WithholdingCertificate,
} from '../types/financeDomain';
import type { ModeReglement } from '../types/paymentTypes';
import { invoiceOutstandingTtc } from './paymentService';
import {
  loadTreasuryAccounts,
  saveTreasuryAccounts,
  insertTransfer,
  insertWithholdingCertificate,
} from './treasuryStorage';

// ——— Trésorerie ———

/**
 * Règle d'or caisse : interdiction de solde négatif.
 * Lance une exception bloquante consommée par l'UI (alerte rouge).
 */
export function sortirFluxCaisse(compte: TreasuryAccount, montantDemande: number): void {
  if (compte.type !== 'CAISSE') return;
  const demande = round3(montantDemande);
  if (demande <= 0) return;
  if (round3(compte.soldeActuel) < demande) {
    throw new Error(
      `Fonds insuffisants en caisse : disponible ${formatSolde(compte.soldeActuel)}, demandé ${formatSolde(demande)}.`
    );
  }
}

function formatSolde(n: number): string {
  return `${n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
}

/** Met à jour le solde d'un compte (persistance Supabase). */
export async function applyBalanceDelta(
  companyId: string,
  accountId: string,
  delta: number
): Promise<TreasuryAccount[]> {
  const accounts = await loadTreasuryAccounts(companyId);
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) throw new Error('Compte de trésorerie introuvable.');
  const next = [...accounts];
  next[idx] = { ...next[idx], soldeActuel: round3(next[idx].soldeActuel + delta) };
  if (next[idx].type === 'CAISSE' && next[idx].soldeActuel < -0.0001) {
    throw new Error('Fonds insuffisants en caisse.');
  }
  await saveTreasuryAccounts(companyId, [next[idx]]);
  return next;
}

/**
 * Virement inter-comptes : décrémente source, incrémente destination (transaction logique unique).
 */
export async function executerVirementInterComptes(args: {
  companyId: string;
  compteSourceId: string;
  compteDestinationId: string;
  montant: number;
  dateOperation: string;
  motif: string;
}): Promise<TreasuryAccount[]> {
  const montant = round3(args.montant);
  if (montant <= 0) throw new Error('Montant de virement invalide.');
  if (args.compteSourceId === args.compteDestinationId) {
    throw new Error('Les comptes source et destination doivent être différents.');
  }

  const accounts = await loadTreasuryAccounts(args.companyId);
  const source = accounts.find((a) => a.id === args.compteSourceId);
  const dest = accounts.find((a) => a.id === args.compteDestinationId);
  if (!source || !dest) throw new Error('Compte source ou destination introuvable.');

  sortirFluxCaisse(source, montant);
  if (source.type === 'BANQUE' && round3(source.soldeActuel) < montant) {
    throw new Error(`Solde insuffisant sur ${source.nom}.`);
  }

  const updated = accounts.map((a) => {
    if (a.id === args.compteSourceId) {
      return { ...a, soldeActuel: round3(a.soldeActuel - montant) };
    }
    if (a.id === args.compteDestinationId) {
      return { ...a, soldeActuel: round3(a.soldeActuel + montant) };
    }
    return a;
  });

  await saveTreasuryAccounts(
    args.companyId,
    updated.filter((a) => a.id === args.compteSourceId || a.id === args.compteDestinationId)
  );

  await insertTransfer({
    id: `tr-${Date.now()}`,
    companyId: args.companyId,
    compteSourceId: args.compteSourceId,
    compteDestinationId: args.compteDestinationId,
    montant,
    dateOperation: args.dateOperation,
    motif: args.motif,
    createdAt: new Date().toISOString(),
  });

  return updated;
}

/** Compte cible selon mode : espèce/virement → compte choisi ; effet → attente. */
export function resolveTreasuryTargetAccount(
  accounts: TreasuryAccount[],
  selectedAccountId: string,
  mode: ModeReglement
): TreasuryAccount {
  if (mode === 'CHEQUE' || mode === 'TRAITE') {
    const attente = accounts.find((a) => a.type === 'ATTENTE_EFFETS' && a.actif);
    if (attente) return attente;
  }
  const selected = accounts.find((a) => a.id === selectedAccountId);
  if (!selected) throw new Error('Compte de trésorerie non sélectionné.');
  return selected;
}

/**
 * Validation encaissement effet : transfert attente → compte bancaire réel.
 */
export async function validerEncaissementEffet(args: {
  companyId: string;
  montant: number;
  compteBancaireId: string;
  sensEntrant: boolean;
}): Promise<TreasuryAccount[]> {
  const accounts = await loadTreasuryAccounts(args.companyId);
  const attente = accounts.find((a) => a.type === 'ATTENTE_EFFETS');
  const banque = accounts.find((a) => a.id === args.compteBancaireId);
  if (!attente || !banque) throw new Error('Comptes attente ou banque introuvables.');

  const m = round3(args.montant);
  const sign = args.sensEntrant ? 1 : -1;

  const updated = accounts.map((a) => {
    if (a.id === attente.id) return { ...a, soldeActuel: round3(a.soldeActuel - sign * m) };
    if (a.id === banque.id) return { ...a, soldeActuel: round3(a.soldeActuel + sign * m) };
    return a;
  });
  await saveTreasuryAccounts(
    args.companyId,
    updated.filter((a) => a.id === attente.id || a.id === banque.id)
  );
  return updated;
}

// ——— Retenue à la source ———

export function isRetenueSourceRequise(totalBrutLettre: number): boolean {
  return round3(totalBrutLettre) >= SEUIL_RETENUE_SOURCE_TTC;
}

/** Base RS = TTC − timbre fiscal 1,000 DT (par facture ou ligne). */
export function calculerAssietteRs(montantTtc: number): number {
  return round3(Math.max(0, montantTtc - TIMBRE_FISCAL_DT));
}

export function calculerMontantRs(montantTtc: number, tauxPercent: number): number {
  const assiette = calculerAssietteRs(montantTtc);
  return round3(assiette * (tauxPercent / 100));
}

/** Net à payer = montant saisi − retenue (affichage règlement fournisseur). */
export function calculerNetAPayer(montantBrut: number, montantRs: number): number {
  return round3(Math.max(0, montantBrut - montantRs));
}

export function creerCertificatRetenue(
  partial: Omit<WithholdingCertificate, 'id' | 'createdAt'>
): WithholdingCertificate {
  const id = `rs-${Date.now()}`;
  return {
    ...partial,
    id,
    refCertif: partial.refCertif || id,
    paymentDate: partial.paymentDate || new Date().toISOString().slice(0, 10),
    beneficiaire: partial.beneficiaire ?? null,
    createdAt: new Date().toISOString(),
  };
}

export async function enregistrerCertificatRetenue(
  companyId: string,
  cert: WithholdingCertificate
): Promise<void> {
  await insertWithholdingCertificate(cert);
}

// ——— Lettrage ———

export function buildLetterageFromDocuments(
  invoices: InvoiceRow[],
  avoirs: AvoirFinancier[]
): LetterageLine[] {
  const factureLines: LetterageLine[] = invoices
    .filter((inv) => ['issued', 'partial'].includes(inv.status))
    .map((invoice) => {
      const reste = invoiceOutstandingTtc(invoice);
      return {
        kind: 'FACTURE' as const,
        id: invoice.id,
        numero: invoice.numero,
        date: invoice.issue_date,
        montantTtc: round3(Number(invoice.total_ttc)),
        resteAPayer: reste,
        montantAImputer: 0,
        selected: false,
        invoice,
      };
    })
    .filter((l) => l.resteAPayer > 0);

  const avoirLines: LetterageLine[] = avoirs
    .filter((a) => a.status === 'valide' && a.creditRestant > 0)
    .map((a) => ({
      kind: 'AVOIR' as const,
      id: a.id,
      numero: a.numero,
      date: a.issueDate,
      montantTtc: round3(-a.creditRestant),
      resteAPayer: round3(a.creditRestant),
      montantAImputer: 0,
      selected: false,
      avoirId: a.id,
    }));

  return [...factureLines, ...avoirLines].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Répartition automatique : du plus ancien au plus récent jusqu'à épuisement du montant.
 */
export function solderAutomatiquement(montantDisponible: number, lines: LetterageLine[]): LetterageLine[] {
  let reste = round3(montantDisponible);
  return lines.map((line) => {
    if (reste <= 0) {
      return { ...line, selected: false, montantAImputer: 0 };
    }
    if (line.kind === 'AVOIR') {
      const apply = round3(Math.min(reste, line.resteAPayer));
      reste = round3(reste - apply);
      return { ...line, selected: apply > 0, montantAImputer: apply };
    }
    const cap = line.resteAPayer;
    const apply = round3(Math.min(reste, cap));
    reste = round3(reste - apply);
    return { ...line, selected: apply > 0, montantAImputer: apply };
  });
}

export function computeLetterageTotals(
  montantSaisi: number,
  lines: LetterageLine[],
  retenueSource = 0
) {
  const factureImpute = round3(
    lines
      .filter((l) => l.kind === 'FACTURE' && l.selected)
      .reduce((s, l) => s + l.montantAImputer, 0)
  );
  const avoirApplique = round3(
    lines
      .filter((l) => l.kind === 'AVOIR' && l.selected)
      .reduce((s, l) => s + l.montantAImputer, 0)
  );
  const netImputation = round3(factureImpute - avoirApplique);
  const rs = isRetenueSourceRequise(factureImpute) ? round3(retenueSource) : 0;
  return {
    montantSaisi: round3(montantSaisi),
    montantAffecte: netImputation,
    montantRestant: round3(Math.max(0, montantSaisi - netImputation)),
    retenueSource: rs,
    netAPayer: calculerNetAPayer(montantSaisi, rs),
    avoirApplique,
  };
}

// ——— Avoirs financiers ———

export function computeAvoirLineTotals(line: Pick<AvoirFinancierLine, 'montantHt' | 'tauxTva'>): AvoirFinancierLine {
  const montantTva = calculerMontantTva(line.montantHt, line.tauxTva);
  const montantTtc = calculerTtcDepuisHt(line.montantHt, line.tauxTva);
  return {
    ...line,
    montantTva,
    montantTtc,
  };
}

export function computeAvoirTotals(lignes: AvoirFinancierLine[]): {
  totalHt: number;
  totalTva: number;
  totalTtc: number;
} {
  const totalHt = round3(lignes.reduce((s, l) => s + l.montantHt, 0));
  const totalTva = round3(lignes.reduce((s, l) => s + l.montantTva, 0));
  const totalTtc = round3(lignes.reduce((s, l) => s + l.montantTtc, 0));
  return { totalHt, totalTva, totalTtc };
}

// ——— TVA mensuelle ———

export function buildVatMonthlyDeclaration(args: {
  companyId: string;
  mois: number;
  annee: number;
  ventesLignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }>;
  achatsLignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }>;
  immobilisationsLignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }>;
}): VatMonthlyDeclaration {
  const collectee = agregerTvaParTaux(args.ventesLignes);
  const deductibleAchats = agregerTvaParTaux(args.achatsLignes);
  const deductibleImmobilisations = agregerTvaParTaux(args.immobilisationsLignes);

  const totalCollectee = round3(collectee.reduce((s, r) => s + r.totalTva, 0));
  const totalDeductible = round3(
    deductibleAchats.reduce((s, r) => s + r.totalTva, 0) +
      deductibleImmobilisations.reduce((s, r) => s + r.totalTva, 0)
  );
  const { solde, estCredit } = calculerSoldeDeclarationTva(totalCollectee, totalDeductible);

  return {
    companyId: args.companyId,
    mois: args.mois,
    annee: args.annee,
    collectee,
    deductibleAchats,
    deductibleImmobilisations,
    totalCollectee,
    totalDeductible,
    solde,
    estCredit,
  };
}

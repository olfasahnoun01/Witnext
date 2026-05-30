/**
 * API règlements Finance — persistance Supabase (sans SQL embarqué ici).
 */

import { supabase } from '@/integrations/supabase/client';
import { round3 } from '../lib/money';
import type { InvoiceRow, PaymentRow } from '../types';
import type {
  CounterpartyOption,
  ModeReglement,
  PaymentFinanceMeta,
  ReglementStatus,
  TraitePortfolioItem,
  TraiteStatus,
} from '../types/paymentTypes';
import {
  generateNumeroPiece,
  initialTraiteStatus,
  invoiceOutstandingTtc,
  mapModeToDbMethod,
  parsePaymentMeta,
  resolveInvoiceStatusAfterPayment,
  serializePaymentMeta,
  shouldPostTreasuryOnSettlement,
  transitionTraiteStatus,
  computeInvoiceReversalOnImpaye,
} from './paymentService';
import type { TraiteAction } from '../types/paymentTypes';
import type { LetterageDocumentKind } from '../types/financeDomain';
import {
  applyBalanceDelta,
  creerCertificatRetenue,
  enregistrerCertificatRetenue,
  resolveTreasuryTargetAccount,
  sortirFluxCaisse,
  validerEncaissementEffet,
} from './financeService';
import { loadTreasuryAccounts } from './treasuryStorage';
import { movementAccountTag } from './treasurySyncApi';
import { applyAvoirCredit } from './avoirApi';

function formatSupabaseError(err: { message?: string }): string {
  return err.message || 'Erreur Supabase';
}

/** Charge les clients pour le sélecteur de tiers. */
export async function fetchClientsForSettlement(): Promise<CounterpartyOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, nom, matricule_fiscale, location')
    .order('nom');
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((c) => ({
    id: c.id,
    label: `${c.nom}${c.matricule_fiscale ? ` — ${c.matricule_fiscale}` : ''}`,
    raisonSociale: c.nom,
    matriculeFiscal: c.matricule_fiscale,
    adresse: c.location,
  }));
}

/** Charge les fournisseurs pour le sélecteur de tiers. */
export async function fetchFournisseursForSettlement(): Promise<CounterpartyOption[]> {
  const { data, error } = await supabase
    .from('fournisseurs')
    .select('id, nom, matricule_fiscale, location')
    .order('nom');
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((f) => ({
    id: f.id,
    label: `${f.nom}${f.matricule_fiscale ? ` — ${f.matricule_fiscale}` : ''}`,
    raisonSociale: f.nom,
    matriculeFiscal: f.matricule_fiscale,
    adresse: f.location,
  }));
}

/** Factures impayées d'un tiers (appariement nom + MF). */
export async function fetchUnpaidInvoicesForCounterparty(
  companyId: string,
  invoiceType: 'vente' | 'achat',
  counterparty: CounterpartyOption
): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .eq('invoice_type', invoiceType)
    .in('status', ['issued', 'partial'])
    .order('issue_date', { ascending: true });

  if (error) throw new Error(formatSupabaseError(error));

  const mf = counterparty.matriculeFiscal?.trim().toLowerCase();
  const name = counterparty.raisonSociale.trim().toLowerCase();

  return ((data ?? []) as InvoiceRow[]).filter((inv) => {
    const invName = (inv.counterpart_name || '').trim().toLowerCase();
    const invMf = (inv.counterpart_tax_id || '').trim().toLowerCase();
    if (mf && invMf && mf === invMf) return true;
    return invName === name;
  });
}

/** Solde caisse : somme des mouvements catégorie cash_register. */
export async function fetchCashBalance(companyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('treasury_movements')
    .select('amount_signed')
    .eq('company_id', companyId)
    .eq('category', 'cash_register');

  if (error) throw new Error(formatSupabaseError(error));
  return round3((data ?? []).reduce((s, row) => s + Number(row.amount_signed), 0));
}

export interface SubmitSettlementInput {
  companyId: string;
  direction: 'client' | 'fournisseur';
  treasuryAccountId: string;
  counterparty: CounterpartyOption;
  paymentDate: string;
  montantTotal: number;
  mode: ModeReglement;
  pieceNumero?: string;
  banque?: string;
  dateEcheance?: string;
  reglementStatus?: ReglementStatus;
  userNotes?: string;
  withholdingAmount?: number;
  withholdingRate?: number;
  allocations: Array<{ documentId: string; kind: LetterageDocumentKind; amount: number }>;
}

/**
 * Enregistre un règlement multi-factures (lettrage).
 * — Effets (chèque/traite) : dette tiers réduite, banque non mouvementée tant que non VALIDÉ.
 * — Espèces : contrôle solde caisse en sortie fournisseur.
 */
export async function submitSettlement(input: SubmitSettlementInput): Promise<string> {
  const accounts = loadTreasuryAccounts(input.companyId);
  const targetAccount = resolveTreasuryTargetAccount(
    accounts,
    input.treasuryAccountId,
    input.mode
  );
  const montantMouvement = round3(
    input.allocations
      .filter((a) => a.kind === 'FACTURE')
      .reduce((s, a) => s + a.amount, 0)
  );
  const sensSortant = input.direction === 'fournisseur';

  if (shouldPostTreasuryOnSettlement(input.mode)) {
    if (sensSortant) {
      sortirFluxCaisse(targetAccount, montantMouvement);
      if (targetAccount.type === 'BANQUE' && targetAccount.soldeActuel < montantMouvement) {
        throw new Error(`Solde insuffisant sur ${targetAccount.nom}.`);
      }
    }
    const delta = sensSortant ? -montantMouvement : montantMouvement;
    applyBalanceDelta(input.companyId, targetAccount.id, delta);
  } else if (sensSortant) {
    applyBalanceDelta(input.companyId, targetAccount.id, -montantMouvement);
  } else {
    applyBalanceDelta(input.companyId, targetAccount.id, montantMouvement);
  }

  const direction = input.direction === 'client' ? 'inbound_client' : 'outbound_supplier';
  const traitStatus = initialTraiteStatus(input.mode);
  const defaultReglementStatus: ReglementStatus =
    input.mode === 'CHEQUE' || input.mode === 'TRAITE' ? 'EN_COURS' : 'PAYEE';

  const meta: PaymentFinanceMeta = {
    v: 1,
    modeReglement: input.mode,
    numeroPiece: generateNumeroPiece(input.direction),
    pieceNumero: input.pieceNumero || null,
    banque: input.banque || null,
    dateEcheance: input.dateEcheance || null,
    reglementStatus: input.reglementStatus ?? defaultReglementStatus,
    traitStatus,
    counterpartyId: input.counterparty.id,
    counterpartyType: input.direction === 'client' ? 'client' : 'fournisseur',
    withholdingAmount: input.withholdingAmount,
    withholdingRate: input.withholdingRate,
    treasuryAccountId: targetAccount.id,
  };

  const { data: auth } = await supabase.auth.getUser();
  const appliedTotal = round3(
    input.allocations.filter((a) => a.kind === 'FACTURE').reduce((s, a) => s + a.amount, 0)
  );

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      company_id: input.companyId,
      payment_date: input.paymentDate,
      amount: appliedTotal,
      method: mapModeToDbMethod(input.mode),
      direction,
      counterparty_name: input.counterparty.raisonSociale,
      reference: meta.numeroPiece,
      notes: serializePaymentMeta(meta, input.userNotes),
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();

  if (payErr || !payment) throw new Error(payErr ? formatSupabaseError(payErr) : 'Paiement non créé.');

  for (const alloc of input.allocations) {
    if (alloc.amount <= 0) continue;

    if (alloc.kind === 'AVOIR') {
      applyAvoirCredit(input.companyId, alloc.documentId, alloc.amount);
      continue;
    }

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', alloc.documentId)
      .single();
    if (invErr || !inv) throw new Error('Facture introuvable pour lettrage.');

    const invoice = inv as InvoiceRow;
    const outstanding = invoiceOutstandingTtc(invoice);
    const applied = round3(Math.min(alloc.amount, outstanding));
    if (applied <= 0) continue;

    const { error: allocErr } = await supabase.from('payment_invoice_allocations').insert({
      payment_id: payment.id,
      invoice_id: alloc.documentId,
      amount: applied,
    });
    if (allocErr) throw new Error(formatSupabaseError(allocErr));

    const newPaid = round3(Number(invoice.amount_paid) + applied);
    const newStatus = resolveInvoiceStatusAfterPayment(invoice, applied);
    const { error: updErr } = await supabase
      .from('invoices')
      .update({ amount_paid: newPaid, status: newStatus })
      .eq('id', invoice.id);
    if (updErr) throw new Error(formatSupabaseError(updErr));
  }

  if (
    input.withholdingAmount &&
    input.withholdingAmount > 0 &&
    input.direction === 'fournisseur'
  ) {
    const cert = creerCertificatRetenue({
      companyId: input.companyId,
      mode: 'PAYEUR',
      counterpartyId: input.counterparty.id,
      counterpartyName: input.counterparty.raisonSociale,
      matriculeFiscal: input.counterparty.matriculeFiscal,
      paymentId: payment.id,
      lignes: input.allocations
        .filter((a) => a.kind === 'FACTURE')
        .map((a) => ({
          factureNumero: a.documentId,
          montantTtc: a.amount,
          assiette: 0,
          taux: input.withholdingRate ?? 1,
          montantRetenue: 0,
        })),
      totalRetenue: input.withholdingAmount,
    });
    enregistrerCertificatRetenue(input.companyId, cert);
  }

  if (shouldPostTreasuryOnSettlement(input.mode)) {
    const signed =
      input.direction === 'client' ? appliedTotal : -appliedTotal;
    await supabase.from('treasury_movements').insert({
      company_id: input.companyId,
      movement_date: input.paymentDate,
      label: `${input.direction === 'client' ? 'Encaissement' : 'Décaissement'} ${meta.numeroPiece}`,
      category: input.mode === 'ESPECE' ? 'cash_register' : 'bank_transfer',
      amount_signed: signed,
      linked_payment_id: payment.id,
      notes: [movementAccountTag(targetAccount.id), input.userNotes].filter(Boolean).join(' | ') || null,
      created_by: auth.user?.id ?? null,
    });
  } else {
    await supabase.from('treasury_movements').insert({
      company_id: input.companyId,
      movement_date: input.paymentDate,
      label: `Effet en attente — ${meta.numeroPiece}`,
      category: 'effet_en_attente',
      amount_signed: input.direction === 'client' ? appliedTotal : -appliedTotal,
      linked_payment_id: payment.id,
      notes: `${movementAccountTag(targetAccount.id)} | Statut: ${traitStatus}`,
      created_by: auth.user?.id ?? null,
    });
  }

  return payment.id;
}

/** Liste les traites / chèques en portefeuille (non encaissés ou en cours). */
export async function fetchTraitesPortfolio(companyId: string): Promise<TraitePortfolioItem[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('company_id', companyId)
    .in('method', ['check', 'other'])
    .order('payment_date', { ascending: false });

  if (error) throw new Error(formatSupabaseError(error));

  const items: TraitePortfolioItem[] = [];
  for (const p of (data ?? []) as PaymentRow[]) {
    const meta = parsePaymentMeta(p.notes);
    if (!meta || (meta.modeReglement !== 'CHEQUE' && meta.modeReglement !== 'TRAITE')) continue;
    const statut = meta.traitStatus ?? 'RECU_EMIS';
    if (statut === 'VALIDE') continue;

    items.push({
      paymentId: p.id,
      referencePiece: meta.numeroPiece || p.reference || '—',
      tiers: p.counterparty_name || '—',
      typeTiers: p.direction === 'inbound_client' ? 'Client' : 'Fournisseur',
      mode: meta.modeReglement,
      banque: meta.banque ?? null,
      dateEcheance: meta.dateEcheance ?? null,
      montant: Number(p.amount),
      statut,
      paymentDate: p.payment_date,
    });
  }
  return items;
}

/** Applique une transition sur un effet (portefeuille). */
export async function applyTraiteAction(
  paymentId: string,
  action: TraiteAction
): Promise<void> {
  const { data: payment, error } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  if (error || !payment) throw new Error('Paiement introuvable.');

  const meta = parsePaymentMeta(payment.notes);
  if (!meta?.traitStatus) throw new Error("Ce paiement n'est pas un effet différé.");

  const nextStatus = transitionTraiteStatus(meta.traitStatus as TraiteStatus, action);
  const updatedMeta: PaymentFinanceMeta = { ...meta, traitStatus: nextStatus };

  const { data: auth } = await supabase.auth.getUser();

  if (action === 'VALIDER_ENCAISSEMENT') {
    const bankAccountId = meta.treasuryAccountId;
    const accounts = loadTreasuryAccounts(payment.company_id);
    const bank = accounts.find(
      (a) => a.id === bankAccountId || (a.type === 'BANQUE' && a.actif)
    );
    if (bank) {
      validerEncaissementEffet({
        companyId: payment.company_id,
        montant: Number(payment.amount),
        compteBancaireId: bank.id,
        sensEntrant: payment.direction === 'inbound_client',
      });
    }
    const signed =
      payment.direction === 'inbound_client' ? Number(payment.amount) : -Number(payment.amount);
    await supabase.from('treasury_movements').insert({
      company_id: payment.company_id,
      movement_date: new Date().toISOString().slice(0, 10),
      label: `Encaissement effet ${meta.numeroPiece}`,
      category: 'bank_settlement',
      amount_signed: signed,
      linked_payment_id: payment.id,
      notes: 'Validation portefeuille effets',
      created_by: auth.user?.id ?? null,
    });
  }

  if (action === 'DECLARER_IMPAYE') {
    const { data: allocs } = await supabase
      .from('payment_invoice_allocations')
      .select('invoice_id, amount')
      .eq('payment_id', paymentId);

    for (const alloc of allocs ?? []) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('amount_paid, total_ttc, status')
        .eq('id', alloc.invoice_id)
        .single();
      if (!inv) continue;

      const reversal = computeInvoiceReversalOnImpaye(
        inv as Pick<InvoiceRow, 'amount_paid' | 'total_ttc'>,
        Number(alloc.amount)
      );
      await supabase
        .from('invoices')
        .update({
          amount_paid: reversal.newAmountPaid,
          status: reversal.status,
          metadata: {
            impaye_at: new Date().toISOString(),
            linked_payment_id: paymentId,
            dispute_status: 'litige',
          },
        })
        .eq('id', alloc.invoice_id);
    }

    await supabase.from('treasury_movements').insert({
      company_id: payment.company_id,
      movement_date: new Date().toISOString().slice(0, 10),
      label: `IMPAYÉ — ${meta.numeroPiece}`,
      category: 'effet_impaye',
      amount_signed: 0,
      linked_payment_id: payment.id,
      notes: 'Rejet effet — factures réouvertes',
      created_by: auth.user?.id ?? null,
    });
  }

  const userNotePart = payment.notes?.includes('\n---\n')
    ? payment.notes.split('\n---\n').slice(1).join('\n---\n')
    : null;

  await supabase
    .from('payments')
    .update({ notes: serializePaymentMeta(updatedMeta, userNotePart) })
    .eq('id', paymentId);
}

/** Écritures journal pour états comptables. */
export async function fetchJournalEntriesForStatements(
  companyId: string,
  dateFrom: string,
  dateTo: string
) {
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('company_id', companyId)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date');

  if (error) throw new Error(formatSupabaseError(error));
  if (!entries?.length) return { entries: [], lines: [] };

  const { data: lines, error: lineErr } = await supabase
    .from('journal_lines')
    .select('*')
    .in(
      'journal_entry_id',
      entries.map((e) => e.id)
    );

  if (lineErr) throw new Error(formatSupabaseError(lineErr));
  return { entries: entries ?? [], lines: lines ?? [] };
}

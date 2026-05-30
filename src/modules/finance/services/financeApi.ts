import { supabase } from '@/integrations/supabase/client';
import type { FinanceCompanyRow } from '../types';
import type {
  InvoiceLineRow,
  InvoiceRow,
  PaymentRow,
  InvoiceWriteInput,
  VatRate,
} from '../types';
import { COMPTES_PCG, FODEC_TAUX_STANDARD, TIMBRE_FISCAL_FACTURE_DT } from '../lib/tunisiaFiscal';
import { calculerMontantTva } from '../lib/vatEngine';

function formatSupabaseError(err: { message?: string; details?: string; hint?: string; code?: string }): string {
  const parts = [err.message, err.details, err.hint].filter(Boolean);
  const body = parts.join(' — ') || 'Erreur inconnue';
  return err.code ? `[${err.code}] ${body}` : body;
}

const STORAGE_KEY = 'finance_selected_company_id';

export function readStoredCompanyId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredCompanyId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchUserFinanceCompanies(): Promise<FinanceCompanyRow[]> {
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('finance_list_my_companies');
  if (!rpcErr && rpcRows != null && Array.isArray(rpcRows)) {
    return rpcRows as FinanceCompanyRow[];
  }

  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid) return [];

  const { data: links, error: e1 } = await supabase
    .from('user_companies')
    .select('company_id')
    .eq('user_id', uid);

  if (e1) {
    const wrapped = new Error(formatSupabaseError(e1));
    (wrapped as Error & { cause?: unknown }).cause = rpcErr ?? e1;
    throw wrapped;
  }

  const ids = [...new Set((links ?? []).map((r: { company_id: string }) => r.company_id))];
  if (ids.length === 0) return [];

  const { data: companies, error: e2 } = await supabase
    .from('companies')
    .select('id, code, name, created_at')
    .in('id', ids)
    .order('name');

  if (e2) {
    throw new Error(formatSupabaseError(e2));
  }
  return (companies ?? []) as FinanceCompanyRow[];
}

export async function listInvoices(companyId: string): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

export async function listPayments(companyId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('company_id', companyId)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PaymentRow[];
}

export async function listInvoiceLines(invoiceIds: string[]): Promise<InvoiceLineRow[]> {
  if (invoiceIds.length === 0) return [];
  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InvoiceLineRow[];
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function computeInvoiceLine(
  line: Pick<InvoiceWriteInput['lines'][number], 'quantity' | 'unit_price_ht' | 'vat_rate' | 'subject_to_fodec' | 'remise_percent'>
) {
  const brutHt = round3(line.quantity * line.unit_price_ht);
  const remisePct = Math.min(100, Math.max(0, line.remise_percent ?? 0));
  const montantRemise = round3(brutHt * (remisePct / 100));
  const htApresRemise = round3(brutHt - montantRemise);
  const fodec = line.subject_to_fodec ? round3(htApresRemise * (FODEC_TAUX_STANDARD / 100)) : 0;
  const total_ht = round3(htApresRemise + fodec);
  const total_tva = calculerMontantTva(htApresRemise + fodec, line.vat_rate);
  const total_ttc = round3(total_ht + total_tva);
  return { brut_ht: brutHt, montant_remise: montantRemise, remise_percent: remisePct, total_ht, total_tva, total_ttc, fodec };
}

export function computeInvoiceTotals(
  lines: Array<Pick<InvoiceWriteInput['lines'][number], 'quantity' | 'unit_price_ht' | 'vat_rate' | 'subject_to_fodec' | 'remise_percent'>>,
  options?: { apply_timbre_fiscal?: boolean }
) {
  const totals = lines.reduce(
    (acc, line) => {
      const calc = computeInvoiceLine(line);
      acc.brut_ht += calc.brut_ht;
      acc.montant_remise += calc.montant_remise;
      acc.total_ht += calc.total_ht;
      acc.total_tva += calc.total_tva;
      acc.total_ttc += calc.total_ttc;
      acc.fodec += calc.fodec;
      return acc;
    },
    { brut_ht: 0, montant_remise: 0, total_ht: 0, total_tva: 0, total_ttc: 0, fodec: 0 }
  );
  const timbre = options?.apply_timbre_fiscal ? TIMBRE_FISCAL_FACTURE_DT : 0;
  return {
    brut_ht: round3(totals.brut_ht),
    montant_remise: round3(totals.montant_remise),
    total_ht: round3(totals.total_ht),
    total_tva: round3(totals.total_tva),
    total_ttc: round3(totals.total_ttc + timbre),
    timbre_fiscal: timbre,
    fodec_total: round3(totals.fodec),
  };
}

async function createInvoiceLines(invoiceId: string, lines: InvoiceWriteInput['lines']) {
  const payload = lines.map((line) => {
    const calc = computeInvoiceLine(line);
    return {
      invoice_id: invoiceId,
      product_code: line.product_code || null,
      description: line.description,
      quantity: line.quantity,
      unit_price_ht: line.unit_price_ht,
      vat_rate: line.vat_rate,
      total_ht: calc.total_ht,
      total_tva: calc.total_tva,
      total_ttc: calc.total_ttc,
    };
  });
  const { error } = await supabase.from('invoice_lines').insert(payload);
  if (error) throw error;
}

async function insertInvoice(
  input: InvoiceWriteInput,
  invoiceType: 'vente' | 'achat'
): Promise<string> {
  if (input.lines.length === 0) throw new Error('La facture doit contenir au moins une ligne.');
  const totals = computeInvoiceTotals(input.lines, { apply_timbre_fiscal: input.apply_timbre_fiscal });
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      company_id: input.company_id,
      invoice_type: invoiceType,
      numero: input.numero,
      counterpart_name: input.counterpart_name,
      counterpart_tax_id: input.counterpart_tax_id || null,
      issue_date: input.issue_date,
      due_date: input.due_date || null,
      currency: 'TND',
      total_ht: totals.total_ht,
      vat_amount: totals.total_tva,
      total_ttc: totals.total_ttc,
      amount_paid: 0,
      status: 'draft',
      notes: input.notes || null,
      metadata: {
        timbre_fiscal: totals.timbre_fiscal,
        fodec_total: totals.fodec_total,
        apply_timbre_fiscal: !!input.apply_timbre_fiscal,
        montant_remise: totals.montant_remise,
        line_remises: input.lines.map((l) => l.remise_percent ?? 0),
      },
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw error || new Error('Impossible de créer la facture');
  await createInvoiceLines(data.id, input.lines);
  return data.id;
}

export async function createSalesInvoice(input: InvoiceWriteInput): Promise<string> {
  return insertInvoice(input, 'vente');
}

export async function createPurchaseInvoice(input: InvoiceWriteInput): Promise<string> {
  return insertInvoice(input, 'achat');
}

async function updateInvoice(invoiceId: string, input: InvoiceWriteInput): Promise<void> {
  if (input.lines.length === 0) throw new Error('La facture doit contenir au moins une ligne.');
  const { data: current, error: fetchErr } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();
  if (fetchErr) throw fetchErr;
  if (current.status !== 'draft') {
    throw new Error('Seules les factures en brouillon sont modifiables.');
  }

  const totals = computeInvoiceTotals(input.lines, { apply_timbre_fiscal: input.apply_timbre_fiscal });
  const { error } = await supabase
    .from('invoices')
    .update({
      numero: input.numero,
      counterpart_name: input.counterpart_name,
      counterpart_tax_id: input.counterpart_tax_id || null,
      issue_date: input.issue_date,
      due_date: input.due_date || null,
      total_ht: totals.total_ht,
      vat_amount: totals.total_tva,
      total_ttc: totals.total_ttc,
      notes: input.notes || null,
      metadata: {
        timbre_fiscal: totals.timbre_fiscal,
        fodec_total: totals.fodec_total,
        apply_timbre_fiscal: !!input.apply_timbre_fiscal,
        montant_remise: totals.montant_remise,
        line_remises: input.lines.map((l) => l.remise_percent ?? 0),
      },
    })
    .eq('id', invoiceId);
  if (error) throw error;

  const { error: delErr } = await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
  if (delErr) throw delErr;
  await createInvoiceLines(invoiceId, input.lines);
}

export async function updateSalesInvoice(invoiceId: string, input: InvoiceWriteInput): Promise<void> {
  return updateInvoice(invoiceId, input);
}

export async function updatePurchaseInvoice(invoiceId: string, input: InvoiceWriteInput): Promise<void> {
  return updateInvoice(invoiceId, input);
}

export async function deleteSalesInvoice(invoiceId: string): Promise<void> {
  return deleteFinanceInvoice(invoiceId);
}

export async function deleteFinanceInvoice(invoiceId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();
  if (fetchErr) throw fetchErr;
  if (!['draft', 'void'].includes(row.status)) {
    throw new Error('Suppression autorisée uniquement pour les factures Brouillon/Annulées.');
  }
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}

function vatAccountCodeCollectee(rate: VatRate): string {
  if (rate === 0) return COMPTES_PCG.tvaCollecteeAutre;
  return COMPTES_PCG.tvaCollectee19;
}

export async function validateSalesInvoice(invoice: InvoiceRow, lines: InvoiceLineRow[]): Promise<void> {
  return validateFinanceInvoice(invoice, lines, 'vente');
}

export async function validatePurchaseInvoice(invoice: InvoiceRow, lines: InvoiceLineRow[]): Promise<void> {
  return validateFinanceInvoice(invoice, lines, 'achat');
}

async function validateFinanceInvoice(
  invoice: InvoiceRow,
  lines: InvoiceLineRow[],
  kind: 'vente' | 'achat'
): Promise<void> {
  if (invoice.status !== 'draft') throw new Error('Seules les factures brouillon peuvent être validées.');
  const metadata = (invoice.metadata || {}) as Record<string, unknown>;
  if (metadata.journal_entry_id || metadata.sales_journal_entry_id) {
    throw new Error('Écriture comptable déjà générée.');
  }
  const timbre = Number(metadata.timbre_fiscal ?? 0);

  const { data: auth } = await supabase.auth.getUser();
  const vatByRate = new Map<number, number>();
  lines.forEach((line) => {
    vatByRate.set(line.vat_rate, round3((vatByRate.get(line.vat_rate) || 0) + Number(line.total_tva)));
  });

  const { data: entry, error: entryErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id: invoice.company_id,
      entry_date: invoice.issue_date,
      reference: invoice.numero,
      memo: `Facture ${kind} ${invoice.numero} - ${invoice.counterpart_name || ''}`.trim(),
      source: kind === 'vente' ? 'sales_invoice_validation' : 'purchase_invoice_validation',
      posted: true,
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();
  if (entryErr || !entry) throw entryErr || new Error('Impossible de créer l’écriture comptable.');

  const journalLines: Array<{
    journal_entry_id: string;
    account_code: string;
    line_memo: string;
    debit: number;
    credit: number;
    vat_code?: string;
  }> = [];

  if (kind === 'vente') {
    journalLines.push(
      {
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.clients,
        line_memo: `Client ${invoice.counterpart_name || ''}`.trim(),
        debit: Number(invoice.total_ttc),
        credit: 0,
      },
      {
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.ventes,
        line_memo: 'Ventes HT',
        debit: 0,
        credit: Number(invoice.total_ht),
      }
    );
    vatByRate.forEach((amount, rate) => {
      if (amount <= 0) return;
      journalLines.push({
        journal_entry_id: entry.id,
        account_code: vatAccountCodeCollectee(rate as VatRate),
        line_memo: `TVA collectée ${rate}%`,
        debit: 0,
        credit: amount,
        vat_code: `TVA_${rate}`,
      });
    });
    if (timbre > 0) {
      journalLines.push({
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.timbreFiscal,
        line_memo: 'Timbre fiscal',
        debit: 0,
        credit: timbre,
      });
    }
  } else {
    journalLines.push(
      {
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.achats,
        line_memo: 'Achats HT',
        debit: Number(invoice.total_ht),
        credit: 0,
      },
      {
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.fournisseurs,
        line_memo: `Fournisseur ${invoice.counterpart_name || ''}`.trim(),
        debit: 0,
        credit: Number(invoice.total_ttc),
      }
    );
    const totalTva = round3(lines.reduce((s, l) => s + Number(l.total_tva), 0));
    if (totalTva > 0) {
      journalLines.push({
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.tvaDeductible,
        line_memo: 'TVA déductible achats',
        debit: totalTva,
        credit: 0,
        vat_code: 'TVA_DED',
      });
    }
    if (timbre > 0) {
      journalLines.push({
        journal_entry_id: entry.id,
        account_code: COMPTES_PCG.achats,
        line_memo: 'Timbre fiscal (achat)',
        debit: timbre,
        credit: 0,
      });
    }
  }

  const { error: lineErr } = await supabase.from('journal_lines').insert(journalLines);
  if (lineErr) throw lineErr;

  const { error: invErr } = await supabase
    .from('invoices')
    .update({
      status: 'issued',
      metadata: {
        ...(metadata || {}),
        journal_entry_id: entry.id,
        sales_journal_entry_id: entry.id,
        posted_at: new Date().toISOString(),
      },
    })
    .eq('id', invoice.id);
  if (invErr) throw invErr;
}

export async function cancelSalesInvoice(invoiceId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('invoices')
    .select('amount_paid,status')
    .eq('id', invoiceId)
    .single();
  if (fetchErr) throw fetchErr;
  if (Number(row.amount_paid) > 0) {
    throw new Error('Impossible d’annuler une facture déjà encaissée.');
  }
  if (!['draft', 'issued'].includes(row.status)) {
    throw new Error('Statut incompatible pour annulation.');
  }
  const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', invoiceId);
  if (error) throw error;
}

export async function registerSalesPayment(args: {
  invoice: InvoiceRow;
  amount: number;
  method: 'cash' | 'check' | 'transfer' | 'card' | 'other';
  reference?: string;
  notes?: string;
}): Promise<void> {
  if (args.amount <= 0) throw new Error('Montant invalide.');
  if (args.invoice.status === 'void') throw new Error('Facture annulée.');
  const outstanding = round3(Number(args.invoice.total_ttc) - Number(args.invoice.amount_paid));
  if (outstanding <= 0) throw new Error('Facture déjà soldée.');
  const applied = Math.min(args.amount, outstanding);

  const { data: auth } = await supabase.auth.getUser();
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      company_id: args.invoice.company_id,
      payment_date: new Date().toISOString().slice(0, 10),
      amount: applied,
      method: args.method,
      direction: 'inbound_client',
      counterparty_name: args.invoice.counterpart_name,
      reference: args.reference || null,
      notes: args.notes || null,
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();
  if (payErr || !payment) throw payErr || new Error('Paiement non créé.');

  const { error: allocErr } = await supabase.from('payment_invoice_allocations').insert({
    payment_id: payment.id,
    invoice_id: args.invoice.id,
    amount: applied,
  });
  if (allocErr) throw allocErr;

  const newPaid = round3(Number(args.invoice.amount_paid) + applied);
  const newStatus: InvoiceRow['status'] = newPaid >= Number(args.invoice.total_ttc) ? 'paid' : 'partial';
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ amount_paid: newPaid, status: newStatus })
    .eq('id', args.invoice.id);
  if (updateErr) throw updateErr;

  await supabase.from('treasury_movements').insert({
    company_id: args.invoice.company_id,
    movement_date: new Date().toISOString().slice(0, 10),
    label: `Encaissement facture ${args.invoice.numero}`,
    category: 'sales_collection',
    amount_signed: applied,
    linked_payment_id: payment.id,
    notes: args.notes || null,
    created_by: auth.user?.id ?? null,
  });
}

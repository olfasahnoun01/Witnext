import { supabase } from '@/integrations/supabase/client';
import type { FinanceCompanyRow } from '../types';
import type {
  InvoiceLineRow,
  InvoiceRow,
  PaymentRow,
  SalesInvoiceWriteInput,
  VatRate,
} from '../types';

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
  line: Pick<SalesInvoiceWriteInput['lines'][number], 'quantity' | 'unit_price_ht' | 'vat_rate'>
) {
  const total_ht = round3(line.quantity * line.unit_price_ht);
  const total_tva = round3(total_ht * (line.vat_rate / 100));
  const total_ttc = round3(total_ht + total_tva);
  return { total_ht, total_tva, total_ttc };
}

export function computeInvoiceTotals(
  lines: Array<Pick<SalesInvoiceWriteInput['lines'][number], 'quantity' | 'unit_price_ht' | 'vat_rate'>>
) {
  const totals = lines.reduce(
    (acc, line) => {
      const calc = computeInvoiceLine(line);
      acc.total_ht += calc.total_ht;
      acc.total_tva += calc.total_tva;
      acc.total_ttc += calc.total_ttc;
      return acc;
    },
    { total_ht: 0, total_tva: 0, total_ttc: 0 }
  );
  return {
    total_ht: round3(totals.total_ht),
    total_tva: round3(totals.total_tva),
    total_ttc: round3(totals.total_ttc),
  };
}

async function createInvoiceLines(invoiceId: string, lines: SalesInvoiceWriteInput['lines']) {
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

export async function createSalesInvoice(input: SalesInvoiceWriteInput): Promise<string> {
  if (input.lines.length === 0) throw new Error('La facture doit contenir au moins une ligne.');
  const totals = computeInvoiceTotals(input.lines);
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      company_id: input.company_id,
      invoice_type: 'vente',
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
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw error || new Error('Impossible de créer la facture');
  await createInvoiceLines(data.id, input.lines);
  return data.id;
}

export async function updateSalesInvoice(invoiceId: string, input: SalesInvoiceWriteInput): Promise<void> {
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

  const totals = computeInvoiceTotals(input.lines);
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
    })
    .eq('id', invoiceId);
  if (error) throw error;

  const { error: delErr } = await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
  if (delErr) throw delErr;
  await createInvoiceLines(invoiceId, input.lines);
}

export async function deleteSalesInvoice(invoiceId: string): Promise<void> {
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

function vatAccountCode(rate: VatRate): string {
  if (rate === 0) return '445799';
  return '445710';
}

export async function validateSalesInvoice(invoice: InvoiceRow, lines: InvoiceLineRow[]): Promise<void> {
  if (invoice.status !== 'draft') throw new Error('Seules les factures brouillon peuvent être validées.');
  const metadata = (invoice.metadata || {}) as Record<string, unknown>;
  if (metadata.sales_journal_entry_id) throw new Error('Écriture comptable déjà générée.');

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
      memo: `Facture vente ${invoice.numero} - ${invoice.counterpart_name || ''}`.trim(),
      source: 'sales_invoice_validation',
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
  }> = [
    {
      journal_entry_id: entry.id,
      account_code: '411000',
      line_memo: `Client ${invoice.counterpart_name || ''}`.trim(),
      debit: Number(invoice.total_ttc),
      credit: 0,
    },
    {
      journal_entry_id: entry.id,
      account_code: '700000',
      line_memo: 'Ventes HT',
      debit: 0,
      credit: Number(invoice.total_ht),
    },
  ];

  vatByRate.forEach((amount, rate) => {
    if (amount <= 0) return;
    journalLines.push({
      journal_entry_id: entry.id,
      account_code: vatAccountCode(rate as VatRate),
      line_memo: `TVA collectée ${rate}%`,
      debit: 0,
      credit: amount,
      vat_code: `TVA_${rate}`,
    });
  });

  const { error: lineErr } = await supabase.from('journal_lines').insert(journalLines);
  if (lineErr) throw lineErr;

  const { error: invErr } = await supabase
    .from('invoices')
    .update({
      status: 'issued',
      metadata: {
        ...(metadata || {}),
        sales_journal_entry_id: entry.id,
        sales_posted_at: new Date().toISOString(),
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

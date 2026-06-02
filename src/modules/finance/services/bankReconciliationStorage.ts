/**
 * Relevés bancaires importés — persistance Supabase par société (RLS user_companies).
 */

import { supabase } from '@/integrations/supabase/client';

export interface BankStatementLine {
  id: string;
  accountId: string;
  operationDate: string;
  valueDate: string | null;
  label: string;
  amountSigned: number;
  reference: string | null;
  matchedMovementId: string | null;
  matchedPaymentId: string | null;
}

function fail(err: { message?: string } | null, fallback: string): never {
  throw new Error(err?.message || fallback);
}

export async function loadBankStatementLines(companyId: string): Promise<BankStatementLine[]> {
  const { data, error } = await supabase
    .from('bank_statement_lines')
    .select('*')
    .eq('company_id', companyId)
    .order('operation_date', { ascending: true });
  if (error) fail(error, 'Chargement des relevés bancaires impossible');
  return (data ?? []).map((r) => ({
    id: r.id,
    accountId: r.account_id,
    operationDate: r.operation_date,
    valueDate: r.value_date,
    label: r.label,
    amountSigned: Number(r.amount_signed),
    reference: r.reference,
    matchedMovementId: r.matched_movement_id,
    matchedPaymentId: r.matched_payment_id,
  }));
}

export async function saveBankStatementLines(
  companyId: string,
  lines: BankStatementLine[]
): Promise<void> {
  if (lines.length === 0) return;
  const rows = lines.map((l) => ({
    id: l.id,
    company_id: companyId,
    account_id: l.accountId,
    operation_date: l.operationDate,
    value_date: l.valueDate,
    label: l.label,
    amount_signed: l.amountSigned,
    reference: l.reference,
    matched_movement_id: l.matchedMovementId,
    matched_payment_id: l.matchedPaymentId,
  }));
  const { error } = await supabase
    .from('bank_statement_lines')
    .upsert(rows, { onConflict: 'id' });
  if (error) fail(error, 'Enregistrement des relevés bancaires impossible');
}

/** Parse CSV simple : date;libellé;montant (virgule décimale). */
export function parseBankStatementCsv(
  csvText: string,
  accountId: string
): BankStatementLine[] {
  const rows = csvText.trim().split(/\r?\n/).slice(1);
  const out: BankStatementLine[] = [];
  for (const row of rows) {
    const parts = row.split(/[;,]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;
    const amount = Number(parts[2].replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) continue;
    out.push({
      id: `bsl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accountId,
      operationDate: parts[0],
      valueDate: parts[0],
      label: parts[1],
      amountSigned: amount,
      reference: parts[3] || null,
      matchedMovementId: null,
      matchedPaymentId: null,
    });
  }
  return out;
}

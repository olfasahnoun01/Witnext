/**
 * Relevés bancaires importés — persistance locale (en attendant tables dédiées).
 */

import type { TreasuryAccount } from '../types/financeDomain';

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

const KEY = (companyId: string) => `finance_bank_statements_v1_${companyId}`;

export function loadBankStatementLines(companyId: string): BankStatementLine[] {
  try {
    const raw = localStorage.getItem(KEY(companyId));
    return raw ? (JSON.parse(raw) as BankStatementLine[]) : [];
  } catch {
    return [];
  }
}

export function saveBankStatementLines(companyId: string, lines: BankStatementLine[]): void {
  localStorage.setItem(KEY(companyId), JSON.stringify(lines));
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

/**
 * Synchronisation soldes comptes trésorerie ↔ mouvements Supabase treasury_movements.
 */

import { supabase } from '@/integrations/supabase/client';
import { round3 } from '../lib/money';
import type { TreasuryAccount } from '../types/financeDomain';
import { loadTreasuryAccounts, saveTreasuryAccounts } from './treasuryStorage';

const ACCOUNT_META_PREFIX = 'finance_account_id:';

/** Associe un mouvement à un compte via notes (en attendant colonne account_id). */
export function movementAccountTag(accountId: string): string {
  return `${ACCOUNT_META_PREFIX}${accountId}`;
}

export function parseMovementAccountId(notes: string | null): string | null {
  if (!notes?.includes(ACCOUNT_META_PREFIX)) return null;
  const m = notes.match(/finance_account_id:([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/**
 * Recalcule les soldes des comptes à partir de treasury_movements tagués + solde initial local.
 */
export async function syncTreasuryBalancesFromMovements(companyId: string): Promise<TreasuryAccount[]> {
  const accounts = loadTreasuryAccounts(companyId);
  const { data, error } = await supabase
    .from('treasury_movements')
    .select('amount_signed, notes, category')
    .eq('company_id', companyId);

  if (error) throw new Error(error.message);

  const deltas = new Map<string, number>();
  for (const acc of accounts) {
    deltas.set(acc.id, 0);
  }

  for (const mov of data ?? []) {
    const accountId = parseMovementAccountId(mov.notes as string | null);
    if (!accountId || !deltas.has(accountId)) continue;
    deltas.set(accountId, round3((deltas.get(accountId) ?? 0) + Number(mov.amount_signed)));
  }

  const updated = accounts.map((a) => ({
    ...a,
    soldeActuel: round3(deltas.get(a.id) ?? 0),
  }));

  saveTreasuryAccounts(companyId, updated);
  return updated;
}

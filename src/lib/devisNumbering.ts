import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

export type DevisNumberMode = 'devis' | 'bc' | 'ba';

/** Prefix used in devis.devis_number for each document kind. */
export function devisNumberPrefix(
  type: 'achat' | 'vente',
  mode: DevisNumberMode
): string {
  if (mode === 'bc') return type === 'achat' ? 'BCE' : 'BCS';
  if (mode === 'ba') return 'BA';
  return type === 'achat' ? 'DE' : 'DS';
}

/**
 * Compute the next document number from existing numbers for a prefix.
 * Exported for tests — production code should prefer {@link allocateDevisNumber}.
 */
export function nextDevisNumberFromExisting(prefix: string, existingNumbers: string[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let maxNum = 0;
  for (const raw of existingNumbers) {
    const m = String(raw).trim().match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const next = maxNum + 1;
  const pad = next >= 100 ? String(next).length : 2;
  return `${prefix}-${String(next).padStart(pad, '0')}`;
}

async function fetchExistingDevisNumbers(_companyId: string, prefix: string): Promise<string[]> {
  // Scan ALL rows for this prefix (any company / null). Until uniqueness is
  // strictly per-company, a global unique index on devis_number means numbers
  // used by legacy or other-company rows must not be re-issued.
  const { data, error } = await supabase
    .from('devis')
    .select('devis_number')
    .ilike('devis_number', `${prefix}-%`);

  if (error) throw error;
  return (data ?? []).map((row) => String((row as { devis_number: string }).devis_number));
}

function numberAlreadyTaken(candidate: string, existing: string[]): boolean {
  const target = candidate.trim().toLowerCase();
  return existing.some((n) => String(n).trim().toLowerCase() === target);
}

/** Client-side fallback when the DB RPC is not deployed yet (or returns a collision). */
export async function fetchNextDevisNumberFromDb(
  type: 'achat' | 'vente',
  mode: DevisNumberMode = 'devis'
): Promise<string> {
  const companyId = requireActiveCompanyId();
  const prefix = devisNumberPrefix(type, mode);
  const existing = await fetchExistingDevisNumbers(companyId, prefix);
  return nextDevisNumberFromExisting(prefix, existing);
}

/**
 * Atomically allocate the next commercial document number (per company + prefix).
 * Falls back to a DB max-query if the RPC is missing or returns a number already in use
 * (common when legacy rows have company_id IS NULL and the RPC only scans the current company).
 */
export async function allocateDevisNumber(
  type: 'achat' | 'vente',
  mode: DevisNumberMode = 'devis'
): Promise<string> {
  const companyId = requireActiveCompanyId();
  const prefix = devisNumberPrefix(type, mode);

  const { data, error } = await supabase.rpc('allocate_devis_number', {
    p_company_id: companyId,
    p_prefix: prefix,
  });

  if (!error && typeof data === 'string' && data.length > 0) {
    try {
      const existing = await fetchExistingDevisNumbers(companyId, prefix);
      if (!numberAlreadyTaken(data, existing)) {
        return data;
      }
      console.warn(
        `[devisNumbering] RPC returned ${data} which already exists; using max+1 fallback`
      );
      return nextDevisNumberFromExisting(prefix, existing);
    } catch (verifyErr) {
      console.warn('[devisNumbering] could not verify RPC number, using it anyway:', verifyErr);
      return data;
    }
  }

  if (error && !/allocate_devis_number|schema cache|function/i.test(error.message)) {
    console.warn('[devisNumbering] RPC failed, using fallback:', error.message);
  }

  return fetchNextDevisNumberFromDb(type, mode);
}

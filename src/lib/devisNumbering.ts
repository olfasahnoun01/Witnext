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

function padDevisSequence(seq: number): string {
  return String(seq).padStart(2, '0');
}

/** Client-side fallback when the DB RPC is not deployed yet. */
export async function fetchNextDevisNumberFromDb(
  type: 'achat' | 'vente',
  mode: DevisNumberMode = 'devis'
): Promise<string> {
  const companyId = requireActiveCompanyId();
  const prefix = devisNumberPrefix(type, mode);

  let query = supabase
    .from('devis')
    .select('devis_number')
    .ilike('devis_number', `${prefix}-%`);
  query = query.eq('company_id' as never, companyId);

  const { data, error } = await query;
  if (error) throw error;

  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let maxNum = 0;
  for (const row of data ?? []) {
    const m = String((row as { devis_number: string }).devis_number).match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }

  return `${prefix}-${padDevisSequence(maxNum + 1)}`;
}

/**
 * Atomically allocate the next commercial document number (per company + prefix).
 * Falls back to a DB max-query if the RPC is missing.
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
    return data;
  }

  if (error && !/allocate_devis_number|schema cache|function/i.test(error.message)) {
    console.warn('[devisNumbering] RPC failed, using fallback:', error.message);
  }

  return fetchNextDevisNumberFromDb(type, mode);
}

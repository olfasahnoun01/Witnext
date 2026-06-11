/** Shared devis row fields for flux / commercial queries (must match DB columns). */

/** Columns that exist on all deployed schemas. */
export const DEVIS_FLUX_SELECT =
  'id, devis_number, devis_date, type, is_bc, is_bl, is_ba, status, third_party_name, source_devis_id, is_ttc, notes, created_at, total_amount, items, third_party_address, third_party_tax_id, third_party_phone';

export const DEVIS_FLUX_SELECT_LITE =
  'id, devis_number, devis_date, type, is_bc, is_bl, is_ba, status, third_party_name, source_devis_id, created_at';

/** Added in later migrations — omitted automatically if not present. */
const DEVIS_FLUX_SELECT_OPTIONAL = ', source_devis_ids, source_bc_id, source_bc_ids';

/** Postgres and PostgREST (PGRST204) wording for unknown columns. */
export function isMissingDevisColumnError(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes('schema cache') && m.includes('column')) return true;
  if (/could not find.*column/i.test(message)) return true;
  return /does not exist/i.test(message) && /column/i.test(message);
}

type DevisQueryResult = { data: unknown[] | null; error: { message: string } | null };

async function runDevisSelect(
  run: (select: string) => Promise<DevisQueryResult>,
  base: string
): Promise<unknown[]> {
  let result = await run(base + DEVIS_FLUX_SELECT_OPTIONAL);
  if (result.error && isMissingDevisColumnError(result.error.message)) {
    result = await run(base);
  }
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export function queryDevisFluxRows(
  run: (select: string) => Promise<DevisQueryResult>
): Promise<unknown[]> {
  return runDevisSelect(run, DEVIS_FLUX_SELECT);
}

export function queryDevisFluxRowsLite(
  run: (select: string) => Promise<DevisQueryResult>
): Promise<unknown[]> {
  return runDevisSelect(run, DEVIS_FLUX_SELECT_LITE);
}

/** Resolve BC devis id from a BL row (source_bc_id when present, else source_devis_id for BL). */
export function resolveBcIdFromBlRow(row: {
  is_bl?: boolean;
  source_bc_id?: number | null;
  source_devis_id?: number | null;
}): number | null {
  if (row.source_bc_id != null) return row.source_bc_id;
  if (row.is_bl && row.source_devis_id != null) return row.source_devis_id;
  return null;
}

/**
 * Apply company_id filter when generated Supabase types omit company_id on some tables.
 */
export function filterByCompanyId<Q extends { eq: (column: string, value: string) => Q }>(
  query: Q,
  companyId: string
): Q {
  return query.eq('company_id', companyId);
}

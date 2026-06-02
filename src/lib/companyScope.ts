import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves the Grosafe company UUID.
 *
 * Ventes / Achats / Inventaire are Grosafe-only modules, so their reads/writes
 * on shared tables (clients, fournisseurs) must be pinned to this id. The value
 * is environment-specific (generated UUID) and is fetched once via a
 * SECURITY DEFINER RPC that bypasses `companies` RLS, then cached for the
 * session.
 */
let grosafeIdCache: string | null = null;
let grosafeIdInflight: Promise<string> | null = null;

export async function getGrosafeCompanyId(): Promise<string> {
  if (grosafeIdCache) return grosafeIdCache;
  if (grosafeIdInflight) return grosafeIdInflight;

  grosafeIdInflight = (async () => {
    const { data, error } = await supabase.rpc('grosafe_company_id');
    if (error) throw new Error(error.message || 'Impossible de résoudre la société Grosafe');
    if (!data) throw new Error('Société Grosafe introuvable');
    grosafeIdCache = data as string;
    return grosafeIdCache;
  })();

  try {
    return await grosafeIdInflight;
  } finally {
    grosafeIdInflight = null;
  }
}

/** Test/util escape hatch to reset the memoized id. */
export function __resetGrosafeCompanyIdCache(): void {
  grosafeIdCache = null;
  grosafeIdInflight = null;
}

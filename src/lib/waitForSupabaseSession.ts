import { supabase } from '@/integrations/supabase/client';

/** Wait until the Supabase client has an access token (avoids RLS calls before JWT is attached). */
export async function waitForSupabaseSession(maxMs = 5000): Promise<boolean> {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    await new Promise((r) => window.setTimeout(r, 50));
  }

  return false;
}

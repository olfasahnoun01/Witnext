import { ensureSupabaseSessionReady } from '@/lib/supabaseSession';

/** Wait until the Supabase client has a valid access token (refreshes if expiring soon). */
export async function waitForSupabaseSession(maxMs = 5000): Promise<boolean> {
  return ensureSupabaseSessionReady(maxMs);
}

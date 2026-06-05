import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { debugLog } from '@/lib/debugLog';

/** True when Supabase rejected the access token (expired / invalid). */
export function isJwtExpiredError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('jwt expired') ||
    m.includes('invalid jwt') ||
    m.includes('token is expired') ||
    m.includes('expired jwt') ||
    (m.includes('jwt') && m.includes('expir'))
  );
}

export function isAuthSessionError(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    isJwtExpiredError(message) ||
    message.includes('refresh_token') ||
    message.includes('Invalid Refresh Token') ||
    message.includes('session_not_found') ||
    message.toLowerCase().includes('not authenticated')
  );
}

const SESSION_READY_BUFFER_SEC = 90;

/**
 * Refresh the session if the access token expires soon (or already expired).
 * Returns false only when there is no session or refresh failed.
 */
export async function refreshSupabaseSessionIfNeeded(
  bufferSec = SESSION_READY_BUFFER_SEC
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.refresh_token) return false;

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec > bufferSec) return true;

  const { data, error } = await supabase.auth.refreshSession();
  const ok = !error && !!data.session?.access_token;
  debugLog('supabaseSession.ts:refresh', 'refreshSession result', {
    ok,
    hasError: !!error,
    errorMsg: error?.message?.slice(0, 80) ?? null,
    secsToExpiry: expiresAt - nowSec,
    bufferSec,
  }, 'A');
  return ok;
}

/** Wait for a session, refreshing proactively before API calls. */
export async function ensureSupabaseSessionReady(maxMs = 8000): Promise<boolean> {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const ready = await refreshSupabaseSessionIfNeeded();
      if (ready) return true;
    } else if (session?.refresh_token) {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.access_token) return true;
    }
    await new Promise((r) => window.setTimeout(r, 100));
  }

  debugLog('supabaseSession.ts:ensureReady', 'ensureSupabaseSessionReady timeout', { maxMs }, 'B');
  return false;
}

type QueryResult<T> = { data: T; error: PostgrestError | null };

/**
 * Runs a Supabase query after ensuring a fresh token; retries once after refresh on JWT errors.
 */
export async function supabaseQueryWithAuthRetry<T>(
  run: () => Promise<QueryResult<T>>
): Promise<QueryResult<T>> {
  await refreshSupabaseSessionIfNeeded();

  let result = await run();
  if (result.error && isJwtExpiredError(result.error.message)) {
    debugLog('supabaseSession.ts:authRetry', 'JWT error on query, retrying', {
      errorMsg: result.error.message?.slice(0, 80),
    }, 'E');
    const refreshed = await refreshSupabaseSessionIfNeeded(0);
    if (refreshed) {
      result = await run();
      debugLog('supabaseSession.ts:authRetry', 'retry after refresh', {
        ok: !result.error,
        errorMsg: result.error?.message?.slice(0, 80) ?? null,
      }, 'E');
    } else {
      debugLog('supabaseSession.ts:authRetry', 'retry refresh failed', {}, 'E');
    }
  }

  return result;
}

export const SESSION_EXPIRED_USER_MESSAGE =
  'Votre session a expiré. Fermez l\'onglet, reconnectez-vous, puis réessayez.';

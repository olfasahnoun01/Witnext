/**
 * Derives localStorage keys used by @supabase/supabase-js from the project URL
 * (e.g. https://abcd.supabase.co → prefix sb-abcd-).
 */
export function getSupabaseLocalStoragePrefix(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl.trim()).hostname;
    const ref = host.split('.')[0];
    if (!ref) return null;
    return `sb-${ref}-`;
  } catch {
    return null;
  }
}

/** Remove all Supabase session keys for this project from localStorage. */
export function clearSupabaseBrowserSession(supabaseUrl: string): void {
  const prefix = getSupabaseLocalStoragePrefix(supabaseUrl);
  if (!prefix || typeof localStorage === 'undefined') return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
}

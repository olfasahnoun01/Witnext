// Supabase browser client — URL and anon key come only from Vite env (see .env.example).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL.trim()) {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Set it in .env.local (see .env.example). Rebuild the app after changing env.'
  );
}
if (typeof SUPABASE_PUBLISHABLE_KEY !== 'string' || !SUPABASE_PUBLISHABLE_KEY.trim()) {
  throw new Error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY. Set it in .env.local (see .env.example). Rebuild the app after changing env.'
  );
}

const url = SUPABASE_URL.trim();
let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid absolute URL (e.g. https://xxxx.supabase.co).');
}
if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
  throw new Error('VITE_SUPABASE_URL must use http: or https:.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(url, SUPABASE_PUBLISHABLE_KEY.trim(), {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Same URL the client uses — useful for storage key helpers. */
export const supabaseProjectUrl = url;

/** Local dev / Electron origins. Deployed project URL comes from SUPABASE_URL at runtime. */
export const STATIC_ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
];

/** Comma-separated list in Supabase secret WEB_APP_ORIGINS (e.g. https://app.vercel.app). */
export function getWebAppOrigins(): string[] {
  const raw = Deno.env.get('WEB_APP_ORIGINS') || '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string): boolean {
  const projectUrl = Deno.env.get('SUPABASE_URL') || '';
  const isProd = (Deno.env.get('DENO_ENV') || Deno.env.get('ENVIRONMENT') || '').toLowerCase() === 'production';

  if (!!projectUrl && origin === projectUrl) return true;
  if (getWebAppOrigins().includes(origin)) return true;

  if (!isProd) {
    if (STATIC_ALLOWED_ORIGINS.includes(origin)) return true;
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  }

  return false;
}

export function getCorsHeaders(
  origin: string | null,
  options?: { extraHeaders?: string; maxAge?: number }
): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : getWebAppOrigins()[0] || Deno.env.get('SUPABASE_URL') || '';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      options?.extraHeaders ?? 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };

  if (options?.maxAge !== undefined) {
    headers['Access-Control-Max-Age'] = String(options.maxAge);
  }

  return headers;
}

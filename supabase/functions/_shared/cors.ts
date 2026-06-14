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
  return (
    (!!projectUrl && origin === projectUrl) ||
    STATIC_ALLOWED_ORIGINS.includes(origin) ||
    getWebAppOrigins().includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
}

export function getCorsHeaders(
  origin: string | null,
  options?: { extraHeaders?: string; maxAge?: number }
): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : Deno.env.get('SUPABASE_URL') || '*';

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

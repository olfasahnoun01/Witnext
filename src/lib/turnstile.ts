/** Cloudflare Turnstile client error codes that must not auto-retry. */
const NON_RETRYABLE = new Set([
  '110100', // Invalid sitekey
  '110110', // Sitekey not found
  '110200', // Domain not authorized
  '200100', // Clock or cache problem
  '400020', // Invalid sitekey
  '400070', // Sitekey disabled
]);

export function isRetryableTurnstileError(code?: string | null): boolean {
  if (!code) return true;
  const normalized = String(code).trim();
  if (NON_RETRYABLE.has(normalized)) return false;
  // Prefix families marked non-retryable in Cloudflare docs use exact codes above.
  return true;
}

export function turnstileErrorMessage(code?: string | null): string {
  const normalized = String(code ?? '').trim();
  switch (normalized) {
    case '110200':
      return (
        `Domaine non autorisé pour ce captcha (${window.location.hostname}). ` +
        'Dans Cloudflare Turnstile → Hostname Management, ajoutez « localhost » ' +
        '(et votre domaine de prod), puis rechargez la page.'
      );
    case '110100':
    case '110110':
    case '400020':
      return 'Clé Turnstile invalide. Vérifiez VITE_TURNSTILE_SITE_KEY dans .env.local.';
    case '400070':
      return 'Ce widget Turnstile est désactivé dans le tableau de bord Cloudflare.';
    case '200100':
      return 'Horloge ou cache navigateur incorrect. Vérifiez la date système, puis réessayez.';
    default:
      return normalized
        ? `Échec du captcha (code ${normalized}). Réessayez ou rechargez la page.`
        : 'Échec du captcha. Réessayez ou rechargez la page.';
  }
}

export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
export const isWebTarget = import.meta.env.VITE_APP_TARGET !== 'electron';
export const captchaConfigured = isWebTarget && turnstileSiteKey.length > 0;
export const captchaConfigMissing = isWebTarget && turnstileSiteKey.length === 0;

/** Arrondi comptable à 3 décimales (millimes tunisiens). */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Affichage monétaire tunisien : séparateur milliers, 3 décimales, suffixe DT.
 * Ex. 1250.35 → "1 250,350 DT"
 */
export function formatMontantDt(amount: number, options?: { suffix?: string }): string {
  const suffix = options?.suffix ?? 'DT';
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toLocaleString('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `${formatted} ${suffix}`.trim();
}

/** Parse une saisie utilisateur (virgule ou point décimal). */
export function parseMontantInput(raw: string): number | null {
  const v = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? round3(n) : null;
}

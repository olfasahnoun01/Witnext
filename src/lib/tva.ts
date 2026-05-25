/** Default VAT rate (Tunisia) — align with devisPricing default. */
export const DEFAULT_TVA_RATE_PERCENT = 19;

/** Net HT after remise (%), then TTC with VAT. */
export function priceTtcFromHt(
  priceHt: number,
  remisePercent = 0,
  tvaPercent = DEFAULT_TVA_RATE_PERCENT
): number {
  const netHt = priceHt * (1 - remisePercent / 100);
  return netHt * (1 + tvaPercent / 100);
}

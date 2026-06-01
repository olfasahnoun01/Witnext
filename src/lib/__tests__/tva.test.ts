import { describe, it, expect } from 'vitest';
import { priceTtcFromHt, DEFAULT_TVA_RATE_PERCENT } from '../tva';

describe('priceTtcFromHt', () => {
  it('defaults to the standard 19% rate', () => {
    expect(DEFAULT_TVA_RATE_PERCENT).toBe(19);
    expect(priceTtcFromHt(100)).toBeCloseTo(119, 3);
  });

  it('applies remise on HT before adding VAT', () => {
    expect(priceTtcFromHt(100, 10, 19)).toBeCloseTo(107.1, 3);
  });

  it('supports reduced rates', () => {
    expect(priceTtcFromHt(100, 0, 7)).toBeCloseTo(107, 3);
    expect(priceTtcFromHt(100, 0, 13)).toBeCloseTo(113, 3);
    expect(priceTtcFromHt(100, 0, 0)).toBeCloseTo(100, 3);
  });
});

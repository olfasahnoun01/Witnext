import { describe, it, expect } from 'vitest';
import {
  round3,
  computeInvoiceLine,
  computeInvoiceTotals,
  vatAccountCodeCollectee,
} from '../invoiceMath';
import { COMPTES_PCG } from '../tunisiaFiscal';

describe('round3 (millime rounding)', () => {
  it('rounds to 3 decimals and avoids float noise', () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(3.8)).toBe(3.8);
    expect(round3(2.3456)).toBe(2.346);
  });
  it('rounds half upward', () => {
    expect(round3(1.0005)).toBe(1.001);
  });
});

describe('computeInvoiceLine', () => {
  it('computes a basic 19% line', () => {
    const c = computeInvoiceLine({ quantity: 2, unit_price_ht: 10, vat_rate: 19 });
    expect(c.brut_ht).toBeCloseTo(20, 3);
    expect(c.total_ht).toBeCloseTo(20, 3);
    expect(c.total_tva).toBeCloseTo(3.8, 3);
    expect(c.total_ttc).toBeCloseTo(23.8, 3);
    expect(c.fodec).toBe(0);
  });

  it('applies remise before VAT', () => {
    const c = computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 19, remise_percent: 10 });
    expect(c.montant_remise).toBeCloseTo(10, 3);
    expect(c.total_ht).toBeCloseTo(90, 3);
    expect(c.total_tva).toBeCloseTo(17.1, 3);
    expect(c.total_ttc).toBeCloseTo(107.1, 3);
  });

  it('adds FODEC to the HT base before VAT', () => {
    const c = computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 19, subject_to_fodec: true });
    expect(c.fodec).toBeCloseTo(1, 3);
    expect(c.total_ht).toBeCloseTo(101, 3);
    expect(c.total_tva).toBeCloseTo(19.19, 3);
    expect(c.total_ttc).toBeCloseTo(120.19, 3);
  });

  it('handles reduced/intermediate/exempt rates', () => {
    expect(computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 7 }).total_tva).toBeCloseTo(7, 3);
    expect(computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 13 }).total_tva).toBeCloseTo(13, 3);
    expect(computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 0 }).total_tva).toBe(0);
  });

  it('clamps remise into [0,100]', () => {
    const over = computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 19, remise_percent: 150 });
    expect(over.remise_percent).toBe(100);
    expect(over.total_ht).toBe(0);

    const under = computeInvoiceLine({ quantity: 1, unit_price_ht: 100, vat_rate: 19, remise_percent: -10 });
    expect(under.remise_percent).toBe(0);
    expect(under.total_ht).toBeCloseTo(100, 3);
  });
});

describe('computeInvoiceTotals', () => {
  const lines = [
    { quantity: 1, unit_price_ht: 100, vat_rate: 19 as const },
    { quantity: 2, unit_price_ht: 50, vat_rate: 19 as const },
  ];

  it('sums line totals', () => {
    const t = computeInvoiceTotals(lines);
    expect(t.brut_ht).toBeCloseTo(200, 3);
    expect(t.total_ht).toBeCloseTo(200, 3);
    expect(t.total_tva).toBeCloseTo(38, 3);
    expect(t.total_ttc).toBeCloseTo(238, 3);
    expect(t.timbre_fiscal).toBe(0);
  });

  it('adds timbre fiscal to TTC when requested', () => {
    const t = computeInvoiceTotals(lines, { apply_timbre_fiscal: true });
    expect(t.timbre_fiscal).toBe(1);
    expect(t.total_ttc).toBeCloseTo(239, 3);
  });
});

describe('vatAccountCodeCollectee (VAT misposting fix)', () => {
  it('only 19% maps to the dedicated collected-VAT account', () => {
    expect(vatAccountCodeCollectee(19)).toBe(COMPTES_PCG.tvaCollectee19);
  });
  it('7%, 13% and 0% go to "autres taux" (never silently posted as 19%)', () => {
    expect(vatAccountCodeCollectee(7)).toBe(COMPTES_PCG.tvaCollecteeAutre);
    expect(vatAccountCodeCollectee(13)).toBe(COMPTES_PCG.tvaCollecteeAutre);
    expect(vatAccountCodeCollectee(0)).toBe(COMPTES_PCG.tvaCollecteeAutre);
    expect(vatAccountCodeCollectee(7)).not.toBe(COMPTES_PCG.tvaCollectee19);
  });
});

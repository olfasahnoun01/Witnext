import { describe, it, expect } from 'vitest';
import {
  computeArticleTableLineTotalHT,
  computeDevisLine,
  computeDevisTotals,
  round3,
  TIMBRE_FISCAL_DT,
} from '../devisPricing';
import type { DevisItem } from '@/types';

function item(partial: Partial<DevisItem>): DevisItem {
  return {
    designation: 'Article',
    fournisseur: 'F',
    prix_ttc: 0,
    remise: 0,
    quantity: 1,
    tva: 19,
    ...partial,
  };
}

describe('round3', () => {
  it('rounds to millimes', () => {
    expect(round3(5.7)).toBe(5.7);
    expect(round3(2.3456)).toBe(2.346);
  });
});

describe('computeArticleTableLineTotalHT', () => {
  it('achat: PU achat HT × qté avec remise (ignore TTC mode)', () => {
    const row = item({ prix_ttc: 50, quantity: 4, remise: 10, tva: 19 });
    expect(computeArticleTableLineTotalHT(row, 'achat', false)).toBeCloseTo(180, 3);
    expect(computeArticleTableLineTotalHT(row, 'achat', true)).toBeCloseTo(180, 3);
  });

  it('vente: PU vente HT × qté avec remise', () => {
    const row = item({ prix_ttc: 100, quantity: 2, remise: 5, tva: 19 });
    expect(computeArticleTableLineTotalHT(row, 'vente', false)).toBeCloseTo(190, 3);
  });

  it('vente TTC mode: dérive le HT avant remise pour Total HT', () => {
    const row = item({ prix_ttc: 119, quantity: 1, remise: 0, tva: 19 });
    expect(computeArticleTableLineTotalHT(row, 'vente', true)).toBeCloseTo(100, 3);
  });
});

describe('computeDevisLine (HT input mode)', () => {
  it('computes a basic 19% line (prix_ttc is PU HT here)', () => {
    const line = computeDevisLine(item({ prix_ttc: 100, quantity: 1, tva: 19 }), false);
    expect(line.unitHT).toBeCloseTo(100, 3);
    expect(line.unitTTC).toBeCloseTo(119, 3);
    expect(line.lineHT).toBeCloseTo(100, 3);
    expect(line.lineTVA).toBeCloseTo(19, 3);
    expect(line.lineTTC).toBeCloseTo(119, 3);
    expect(line.remiseDT_HT).toBe(0);
  });

  it('applies remise on the HT base, then VAT', () => {
    const line = computeDevisLine(item({ prix_ttc: 100, quantity: 2, remise: 10, tva: 19 }), false);
    expect(line.unitAfterRemiseHT).toBeCloseTo(90, 3);
    expect(line.lineHT).toBeCloseTo(180, 3);
    expect(line.lineTVA).toBeCloseTo(34.2, 3);
    expect(line.lineTTC).toBeCloseTo(214.2, 3);
    expect(line.remiseDT_HT).toBeCloseTo(20, 3);
  });

  it('computes per-line VAT from net HT (not as a TTC-HT residual)', () => {
    const line = computeDevisLine(item({ prix_ttc: 10, quantity: 3, tva: 19 }), false);
    expect(line.lineHT).toBeCloseTo(30, 3);
    expect(line.lineTVA).toBeCloseTo(5.7, 3);
    expect(line.lineTTC).toBeCloseTo(35.7, 3);
  });

  it('defaults to 19% VAT when tva is omitted', () => {
    const line = computeDevisLine(item({ prix_ttc: 100, quantity: 1, tva: undefined }), false);
    expect(line.lineTVA).toBeCloseTo(19, 3);
  });
});

describe('computeDevisLine (TTC input mode)', () => {
  it('derives HT from a PU TTC input', () => {
    const line = computeDevisLine(item({ prix_ttc: 119, quantity: 1, tva: 19 }), true);
    expect(line.unitHT).toBeCloseTo(100, 3);
    expect(line.lineHT).toBeCloseTo(100, 3);
    expect(line.lineTVA).toBeCloseTo(19, 3);
    expect(line.lineTTC).toBeCloseTo(119, 3);
  });
});

describe('computeDevisTotals', () => {
  it('aggregates and adds the timbre fiscal', () => {
    const totals = computeDevisTotals([item({ prix_ttc: 100, quantity: 1, tva: 19 })], false);
    expect(totals.totalHT).toBeCloseTo(100, 3);
    expect(totals.totalNet).toBeCloseTo(100, 3);
    expect(totals.totalTVA).toBeCloseTo(19, 3);
    expect(totals.totalTTC).toBeCloseTo(119, 3);
    expect(totals.totalFinal).toBeCloseTo(119 + TIMBRE_FISCAL_DT, 3);
    expect(totals.totalFinalHT).toBeCloseTo(100 + TIMBRE_FISCAL_DT, 3);
  });

  it('sums multiple lines with remise', () => {
    const totals = computeDevisTotals(
      [
        item({ prix_ttc: 100, quantity: 1, tva: 19 }),
        item({ prix_ttc: 100, quantity: 2, remise: 10, tva: 19 }),
      ],
      false
    );
    expect(totals.totalHT).toBeCloseTo(300, 3); // 100 + 200 (gross, before remise)
    expect(totals.totalRemise).toBeCloseTo(20, 3);
    expect(totals.totalNet).toBeCloseTo(280, 3); // 100 + 180
    expect(totals.totalTVA).toBeCloseTo(53.2, 3); // 19 + 34.2
    expect(totals.totalTTC).toBeCloseTo(333.2, 3);
  });
});

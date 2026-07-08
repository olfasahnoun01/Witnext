import { describe, it, expect } from 'vitest';
import {
  computeArticleTableLineTotalHT,
  computeDevisLine,
  computeDevisTotals,
  computeSavedDocumentTotals,
  prepareDevisItemsForPersistence,
  resolveFodecEnabled,
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

  it('defaults to 0% VAT when tva is omitted', () => {
    const line = computeDevisLine(item({ prix_ttc: 100, quantity: 1, tva: undefined }), false);
    expect(line.lineTVA).toBeCloseTo(0, 3);
    expect(line.lineTTC).toBeCloseTo(100, 3);
  });

  it('applies VAT only when user selects a rate', () => {
    const line = computeDevisLine(item({ prix_ttc: 100, quantity: 1, tva: 19 }), false);
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

  it('calculates FODEC for BC supplier (achat) when FODEC is enabled', () => {
    const totals = computeDevisTotals(
      [
        item({ prix_ttc: 100, quantity: 1, tva: 19 }),
        item({ prix_ttc: 100, quantity: 2, remise: 10, tva: 19 }),
      ],
      false,
      { devisType: 'achat', docType: 'bc', isFodecEnabled: true }
    );
    expect(totals.totalFodec).toBeCloseTo(2.8, 3);
    expect(totals.totalFinal).toBeCloseTo(336.532 + TIMBRE_FISCAL_DT, 3);
  });

  it('uses manual FODEC per line when provided', () => {
    const totals = computeDevisTotals(
      [
        item({ prix_ttc: 100, quantity: 1, tva: 19, fodec: 5 }),
        item({ prix_ttc: 100, quantity: 1, tva: 19 }),
      ],
      false,
      { devisType: 'achat', docType: 'bc', isFodecEnabled: true }
    );
    expect(totals.totalFodec).toBeCloseTo(6, 3); // 5 manual + 1 auto
    expect(totals.totalTVA).toBeCloseTo(39.14, 3);
  });

  it('does not calculate FODEC if devisType is not achat or FODEC disabled', () => {
    const t1 = computeDevisTotals(
      [item({ prix_ttc: 100, quantity: 1, tva: 19 })],
      false,
      { devisType: 'vente', docType: 'bc', isFodecEnabled: true }
    );
    expect(t1.totalFodec).toBeUndefined();

    const t2 = computeDevisTotals(
      [item({ prix_ttc: 100, quantity: 1, tva: 19 })],
      false,
      { devisType: 'achat', docType: 'devis', isFodecEnabled: false }
    );
    expect(t2.totalFodec).toBeUndefined();

    const t3 = computeDevisTotals(
      [item({ prix_ttc: 100, quantity: 1, tva: 19 })],
      false,
      { devisType: 'achat', docType: 'bc', isFodecEnabled: false }
    );
    expect(t3.totalFodec).toBeUndefined();
  });
});

describe('computeSavedDocumentTotals', () => {
  it('HT document (is_ttc=false): ignores line TVA rates in totals', () => {
    const totals = computeSavedDocumentTotals({
      items: [item({ prix_ttc: 100, quantity: 2, tva: 19 })],
      type: 'vente',
      is_ttc: false,
    });
    expect(totals.totalTVA).toBe(0);
    expect(totals.totalNet).toBeCloseTo(200, 3);
    expect(totals.totalFinal).toBeCloseTo(200 + TIMBRE_FISCAL_DT, 3);
  });

  it('TTC document (is_ttc=true): includes line TVA in totals', () => {
    const totals = computeSavedDocumentTotals({
      items: [item({ prix_ttc: 100, quantity: 2, tva: 19 })],
      type: 'vente',
      is_ttc: true,
    });
    expect(totals.totalTVA).toBeCloseTo(38, 3);
    expect(totals.totalFinal).toBeCloseTo(238 + TIMBRE_FISCAL_DT, 3);
  });

  it('treats missing is_ttc as HT (no implicit 19% TVA)', () => {
    const totals = computeSavedDocumentTotals({
      items: [item({ prix_ttc: 100, quantity: 1, tva: 19 })],
      type: 'vente',
    });
    expect(totals.totalTVA).toBe(0);
    expect(totals.totalFinal).toBeCloseTo(100 + TIMBRE_FISCAL_DT, 3);
  });

  it('achat document with persisted fodec lines applies FODEC', () => {
    const totals = computeSavedDocumentTotals({
      items: [item({ prix_ttc: 100, quantity: 1, tva: 19, fodec: 1 })],
      type: 'achat',
      is_ttc: true,
      is_bc: true,
    });
    expect(totals.totalFodec).toBeCloseTo(1, 3);
    expect(totals.totalTVA).toBeCloseTo(19.19, 3);
  });
});

describe('prepareDevisItemsForPersistence', () => {
  it('bakes default FODEC per line when toggle is on', () => {
    const items = [item({ prix_ttc: 100, quantity: 1, tva: 19 })];
    const persisted = prepareDevisItemsForPersistence(items, { isFodecEnabled: true });
    expect(persisted[0].fodec).toBeCloseTo(1, 3);
    expect(resolveFodecEnabled({ devisType: 'achat', items: persisted })).toBe(true);
  });

  it('strips FODEC from lines when toggle is off', () => {
    const items = [item({ prix_ttc: 100, quantity: 1, tva: 19, fodec: 1 })];
    const persisted = prepareDevisItemsForPersistence(items, { isFodecEnabled: false });
    expect(persisted[0].fodec).toBeUndefined();
  });

  it('keeps manual FODEC values when toggle is on', () => {
    const items = [item({ prix_ttc: 100, quantity: 1, tva: 19, fodec: 5 })];
    const persisted = prepareDevisItemsForPersistence(items, { isFodecEnabled: true });
    expect(persisted[0].fodec).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { devisPdfShowsTvaBreakdown, getDevisPdfTableColumnWidths } from '../pdfGenerator';

describe('devisPdfShowsTvaBreakdown', () => {
  it('shows TVA when any line has a rate > 0', () => {
    expect(
      devisPdfShowsTvaBreakdown([{ designation: 'A', quantity: 1, remise: 0, prix_ttc: 100, fournisseur: '', tva: 19 }], false)
    ).toBe(true);
  });

  it('hides TVA when all lines are at 0% and legacy is_ttc is false', () => {
    expect(
      devisPdfShowsTvaBreakdown([{ designation: 'A', quantity: 1, remise: 0, prix_ttc: 100, fournisseur: '', tva: 0 }], false)
    ).toBe(false);
  });

  it('shows TVA for legacy documents with is_ttc true', () => {
    expect(
      devisPdfShowsTvaBreakdown([{ designation: 'A', quantity: 1, remise: 0, prix_ttc: 100, fournisseur: '' }], true)
    ).toBe(true);
  });
});

describe('getDevisPdfTableColumnWidths', () => {
  const tableWidth = 182;

  it('sums to full table width for TTC and HT layouts', () => {
    for (const showTva of [true, false]) {
      const widths = getDevisPdfTableColumnWidths(showTva, tableWidth);
      const sum = widths.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(tableWidth, 5);
    }
  });

  it('allocates a readable TVA column (wider than before)', () => {
    const widths = getDevisPdfTableColumnWidths(true, tableWidth);
    const tvaWidth = widths[8];
    expect(tvaWidth).toBeGreaterThan(12);
    expect(tvaWidth / tableWidth).toBeGreaterThan(0.07);
  });
});

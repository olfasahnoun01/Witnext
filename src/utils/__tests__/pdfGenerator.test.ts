import { describe, expect, it } from 'vitest';
import { devisPdfShowsTvaBreakdown } from '../pdfGenerator';

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

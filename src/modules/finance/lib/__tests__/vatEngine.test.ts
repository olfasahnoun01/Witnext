import { describe, it, expect } from 'vitest';
import {
  calculerMontantTva,
  calculerTtcDepuisHt,
  decomposerTtc,
  agregerTvaParTaux,
  calculerSoldeDeclarationTva,
} from '../vatEngine';

describe('calculerMontantTva', () => {
  it('applies the legal Tunisian rates on the HT base', () => {
    expect(calculerMontantTva(100, 19)).toBeCloseTo(19, 3);
    expect(calculerMontantTva(100, 13)).toBeCloseTo(13, 3);
    expect(calculerMontantTva(100, 7)).toBeCloseTo(7, 3);
    expect(calculerMontantTva(100, 0)).toBe(0);
  });
});

describe('calculerTtcDepuisHt / decomposerTtc', () => {
  it('TTC = HT + VAT', () => {
    expect(calculerTtcDepuisHt(100, 19)).toBeCloseTo(119, 3);
  });
  it('decomposes a TTC back into HT + VAT', () => {
    const d = decomposerTtc(119, 19);
    expect(d.ht).toBeCloseTo(100, 3);
    expect(d.tva).toBeCloseTo(19, 3);
    expect(d.ttc).toBeCloseTo(119, 3);
  });
  it('treats exempt (0%) TTC as fully HT', () => {
    const d = decomposerTtc(100, 0);
    expect(d.ht).toBeCloseTo(100, 3);
    expect(d.tva).toBe(0);
  });
});

describe('agregerTvaParTaux', () => {
  it('sums HT and VAT per rate, sorted desc by rate', () => {
    const rows = agregerTvaParTaux([
      { taux: 19, ht: 100, tva: 19 },
      { taux: 19, ht: 50, tva: 9.5 },
      { taux: 7, ht: 200, tva: 14 },
    ]);
    expect(rows[0].taux).toBe(19);
    expect(rows[0].totalHt).toBeCloseTo(150, 3);
    expect(rows[0].totalTva).toBeCloseTo(28.5, 3);
    expect(rows[1].taux).toBe(7);
    expect(rows[1].totalTva).toBeCloseTo(14, 3);
  });
});

describe('calculerSoldeDeclarationTva', () => {
  it('positive solde = VAT due', () => {
    const r = calculerSoldeDeclarationTva(1000, 600);
    expect(r.solde).toBeCloseTo(400, 3);
    expect(r.estCredit).toBe(false);
  });
  it('negative solde = VAT credit', () => {
    const r = calculerSoldeDeclarationTva(600, 1000);
    expect(r.solde).toBeCloseTo(-400, 3);
    expect(r.estCredit).toBe(true);
  });
});

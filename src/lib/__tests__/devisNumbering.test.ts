import { describe, expect, it } from 'vitest';
import { devisNumberPrefix, nextDevisNumberFromExisting } from '@/lib/devisNumbering';

describe('devisNumberPrefix', () => {
  it('maps devis vente/achat', () => {
    expect(devisNumberPrefix('vente', 'devis')).toBe('DS');
    expect(devisNumberPrefix('achat', 'devis')).toBe('DE');
  });

  it('maps BC vente/achat', () => {
    expect(devisNumberPrefix('vente', 'bc')).toBe('BCS');
    expect(devisNumberPrefix('achat', 'bc')).toBe('BCE');
  });

  it('maps BA', () => {
    expect(devisNumberPrefix('vente', 'ba')).toBe('BA');
    expect(devisNumberPrefix('achat', 'ba')).toBe('BA');
  });
});

describe('nextDevisNumberFromExisting', () => {
  it('starts at 01 when empty', () => {
    expect(nextDevisNumberFromExisting('DS', [])).toBe('DS-01');
  });

  it('takes max even when DS-10 already exists among gaps', () => {
    expect(
      nextDevisNumberFromExisting('DS', ['DS-01', 'DS-02', 'DS-10', 'DS-09'])
    ).toBe('DS-11');
  });

  it('ignores other prefixes and non-matching formats', () => {
    expect(
      nextDevisNumberFromExisting('DS', ['DE-50', 'BCS-03', 'DS-FOO', 'DS-07'])
    ).toBe('DS-08');
  });

  it('handles three-digit sequences without zero-padding them back to 2', () => {
    expect(nextDevisNumberFromExisting('DS', ['DS-99'])).toBe('DS-100');
    expect(nextDevisNumberFromExisting('DS', ['DS-100'])).toBe('DS-101');
  });

  it('is case-insensitive on matching', () => {
    expect(nextDevisNumberFromExisting('DS', ['ds-96'])).toBe('DS-97');
  });
});

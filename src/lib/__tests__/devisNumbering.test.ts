import { describe, expect, it } from 'vitest';
import { devisNumberPrefix } from '@/lib/devisNumbering';

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

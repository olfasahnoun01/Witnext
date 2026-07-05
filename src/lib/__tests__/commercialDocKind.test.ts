import { describe, it, expect } from 'vitest';
import { classifyCommercialDoc } from '@/lib/commercialDocKind';

describe('classifyCommercialDoc', () => {
  it('classifies devis client', () => {
    expect(classifyCommercialDoc({ type: 'vente', is_bc: false })).toBe('DEVIS_CLIENT');
  });

  it('classifies devis fournisseur', () => {
    expect(classifyCommercialDoc({ type: 'achat', is_bc: false })).toBe('DEVIS_FOURNISSEUR');
  });

  it('classifies BC client', () => {
    expect(classifyCommercialDoc({ type: 'vente', is_bc: true })).toBe('BC_CLIENT');
  });

  it('classifies BC fournisseur', () => {
    expect(classifyCommercialDoc({ type: 'achat', is_bc: true })).toBe('BC_FOURNISSEUR');
  });

  it('ignores bon livraison', () => {
    expect(classifyCommercialDoc({ type: 'vente', is_bc: true, is_bl: true })).toBe('OTHER');
  });
});

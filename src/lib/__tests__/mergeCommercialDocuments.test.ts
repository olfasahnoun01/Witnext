import { describe, expect, it } from 'vitest';
import type { Devis, DevisItem } from '@/types';
import {
  buildMergedBcNotes,
  buildMergedBlNotes,
  mergeDevisItemsFromSources,
  normalizeThirdPartyKey,
  validateBcMergeForBl,
  validateBcMergeForFacture,
  validateBlMergeForFacture,
  validateDevisMergeForBc,
} from '@/lib/mergeCommercialDocuments';

function makeDevis(overrides: Partial<Devis> & Pick<Devis, 'id' | 'devis_number'>): Devis {
  return {
    type: 'vente',
    third_party_name: 'Client A',
    items: [],
    is_bc: false,
    is_ba: false,
    is_bl: false,
    ...overrides,
  } as Devis;
}

const item = (designation: string): DevisItem => ({
  line_id: `line-${designation}`,
  designation,
  fournisseur: 'F1',
  quantity: 1,
  prix_ttc: 10,
  remise: 0,
  tva: 19,
});

describe('normalizeThirdPartyKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeThirdPartyKey('  Client A  ')).toBe('client a');
    expect(normalizeThirdPartyKey(null)).toBe('');
  });
});

describe('mergeDevisItemsFromSources', () => {
  it('merges items from multiple devis preserving line ids', () => {
    const merged = mergeDevisItemsFromSources([
      makeDevis({ id: 1, devis_number: 'D1', items: [item('A')] }),
      makeDevis({ id: 2, devis_number: 'D2', items: [item('B')] }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].line_id).toBe('line-A');
    expect(merged[1].line_id).toBe('line-B');
  });

  it('assigns merge line ids when source items lack line_id', () => {
    const bare = { designation: 'X', fournisseur: '', prix_ttc: 1, remise: 0, quantity: 1, tva: 19 };
    const merged = mergeDevisItemsFromSources([
      makeDevis({ id: 1, devis_number: 'D1', items: [bare] }),
      makeDevis({ id: 2, devis_number: 'D2', items: [{ ...bare, designation: 'Y' }] }),
    ]);
    expect(merged[0].line_id).toBe('merge-1-0');
    expect(merged[1].line_id).toBe('merge-2-1');
  });
});

describe('validateDevisMergeForBc', () => {
  it('rejects fewer than two devis', () => {
    expect(validateDevisMergeForBc([makeDevis({ id: 1, devis_number: 'D1' })])).toEqual({
      ok: false,
      error: 'Sélectionnez au moins deux devis.',
    });
  });

  it('rejects mixed types', () => {
    const result = validateDevisMergeForBc([
      makeDevis({ id: 1, devis_number: 'D1', type: 'vente' }),
      makeDevis({ id: 2, devis_number: 'D2', type: 'achat' }),
    ]);
    expect(result.ok).toBe(false);
  });

  it('accepts valid vente devis for same party', () => {
    const result = validateDevisMergeForBc([
      makeDevis({ id: 1, devis_number: 'D1', third_party_name: 'Client A' }),
      makeDevis({ id: 2, devis_number: 'D2', third_party_name: 'client a' }),
    ]);
    expect(result).toEqual({ ok: true });
  });
});

describe('validateBcMergeForFacture', () => {
  it('requires at least two BC vente for same client', () => {
    expect(
      validateBcMergeForFacture([
        makeDevis({ id: 1, devis_number: 'BC1', is_bc: true, type: 'vente' }),
      ]).ok
    ).toBe(false);

    expect(
      validateBcMergeForFacture([
        makeDevis({ id: 1, devis_number: 'BC1', is_bc: true, type: 'vente', third_party_name: 'C1' }),
        makeDevis({ id: 2, devis_number: 'BC2', is_bc: true, type: 'vente', third_party_name: 'C1' }),
      ])
    ).toEqual({ ok: true });
  });
});

describe('validateBlMergeForFacture', () => {
  it('requires BL vente documents', () => {
    const result = validateBlMergeForFacture([
      makeDevis({ id: 1, devis_number: 'BL1', is_bl: true, type: 'vente' }),
      makeDevis({ id: 2, devis_number: 'X', is_bl: false, type: 'vente' }),
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('validateBcMergeForBl', () => {
  it('delegates to BC vente merge rules', () => {
    expect(validateBcMergeForBl([]).ok).toBe(false);
  });
});

describe('merged notes helpers', () => {
  it('buildMergedBcNotes lists source devis numbers', () => {
    const notes = buildMergedBcNotes([
      makeDevis({ id: 1, devis_number: 'D1' }),
      makeDevis({ id: 2, devis_number: 'D2' }),
    ]);
    expect(notes).toContain('D1');
    expect(notes).toContain('D2');
  });

  it('buildMergedBlNotes lists source BC numbers', () => {
    const notes = buildMergedBlNotes([
      makeDevis({ id: 1, devis_number: 'BC1', is_bc: true }),
      makeDevis({ id: 2, devis_number: 'BC2', is_bc: true }),
    ]);
    expect(notes).toContain('BC1');
    expect(notes).toContain('BC2');
  });
});

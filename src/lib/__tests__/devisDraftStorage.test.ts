import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDevisDraft, loadDevisDraft, saveDevisDraft } from '@/lib/devisDraftStorage';
import type { DevisItem } from '@/types';

const sampleItems: DevisItem[] = [
  {
    line_id: 'l1',
    designation: 'Casque',
    fournisseur: 'F1',
    quantity: 2,
    prix_ttc: 50,
    remise: 0,
    tva: 19,
  },
];

function installLocalStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
}

describe('devisDraftStorage', () => {
  beforeEach(() => {
    installLocalStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no draft exists', () => {
    expect(loadDevisDraft('company-1', 'vente', 'devis')).toBeNull();
  });

  it('saves and loads a draft with savedAt', () => {
    saveDevisDraft('company-1', 'vente', 'devis', {
      devisType: 'vente',
      docType: 'devis',
      devisNumber: 'DV-001',
      devisDate: '2026-07-09',
      thirdPartyName: 'Client A',
      thirdPartyAddress: '',
      thirdPartyTaxId: '',
      thirdPartyPhone: '',
      notes: '',
      documentStatus: 'draft',
      devisItems: sampleItems,
      isTtc: true,
      isFodecEnabled: false,
    });

    const loaded = loadDevisDraft('company-1', 'vente', 'devis');
    expect(loaded?.devisNumber).toBe('DV-001');
    expect(loaded?.devisItems).toHaveLength(1);
    expect(loaded?.savedAt).toBe('2026-07-09T10:00:00.000Z');
  });

  it('scopes drafts by company and doc type', () => {
    saveDevisDraft('company-a', 'vente', 'devis', {
      devisType: 'vente',
      docType: 'devis',
      devisNumber: 'A',
      devisDate: '2026-07-09',
      thirdPartyName: '',
      thirdPartyAddress: '',
      thirdPartyTaxId: '',
      thirdPartyPhone: '',
      notes: '',
      documentStatus: 'draft',
      devisItems: [],
      isTtc: false,
      isFodecEnabled: false,
    });

    expect(loadDevisDraft('company-b', 'vente', 'devis')).toBeNull();
    expect(loadDevisDraft('company-a', 'achat', 'devis')).toBeNull();
    expect(loadDevisDraft('company-a', 'vente', 'bc')).toBeNull();
  });

  it('clears a draft', () => {
    saveDevisDraft(null, 'vente', 'devis', {
      devisType: 'vente',
      docType: 'devis',
      devisNumber: 'X',
      devisDate: '2026-07-09',
      thirdPartyName: '',
      thirdPartyAddress: '',
      thirdPartyTaxId: '',
      thirdPartyPhone: '',
      notes: '',
      documentStatus: 'draft',
      devisItems: [],
      isTtc: false,
      isFodecEnabled: false,
    });

    clearDevisDraft(null, 'vente', 'devis');
    expect(loadDevisDraft(null, 'vente', 'devis')).toBeNull();
  });

  it('returns null for invalid JSON payload', () => {
    localStorage.setItem('grosafe_devis_draft_global_vente_devis', '{not-json');
    expect(loadDevisDraft(null, 'vente', 'devis')).toBeNull();
  });
});

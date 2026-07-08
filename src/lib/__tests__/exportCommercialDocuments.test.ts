import { describe, it, expect } from 'vitest';
import {
  devisListToExportRows,
  matchesCommercialDocumentDay,
} from '@/lib/exportCommercialDocuments';
import type { Devis } from '@/types';

const sampleDevis: Devis = {
  id: 1,
  type: 'vente',
  devis_number: 'DV-001',
  devis_date: '2026-07-05',
  third_party_name: 'Client Test',
  third_party_address: null,
  third_party_tax_id: '123',
  third_party_phone: '22112233',
  items: [
    {
      designation: 'Produit A',
      quantity: 2,
      prix_ttc: 10,
      remise: 0,
      fournisseur: 'Fournisseur X',
    },
  ],
  total_amount: 20,
  notes: 'Note test',
  status: 'confirmé',
  is_ttc: true,
  is_bc: false,
  is_ba: false,
  source_devis_id: null,
  created_by: 'u1',
  creator_name: 'Ali',
  updated_at: '2026-07-05T10:00:00Z',
  created_at: '2026-07-05T09:00:00Z',
};

describe('exportCommercialDocuments', () => {
  it('matchesCommercialDocumentDay filters by yyyy-MM-dd', () => {
    expect(matchesCommercialDocumentDay('2026-07-05', '2026-07-05')).toBe(true);
    expect(matchesCommercialDocumentDay('2026-07-05T00:00:00Z', '2026-07-05')).toBe(true);
    expect(matchesCommercialDocumentDay('2026-07-06', '2026-07-05')).toBe(false);
    expect(matchesCommercialDocumentDay('2026-07-05', '')).toBe(true);
  });

  it('devisListToExportRows maps core columns', () => {
    const [row] = devisListToExportRows([sampleDevis]);
    expect(row[0]).toBe('Vente');
    expect(row[1]).toBe('DV-001');
    expect(row[2]).toBe('05/07/26');
    expect(row[3]).toBe('Client Test');
    expect(row[6]).toBe('Ali');
    expect(row[10]).toBe('Confirmé');
    expect(row[11]).toBe(1);
    expect(row[12]).toBe(2);
    expect(row[14]).toBe('TTC');
    expect(row[15]).toBe('Note test');
  });
});

import { describe, expect, it } from 'vitest';
import { parseDevisRow } from '@/modules/commercial/quotations/lib/parseDevisRow';
import { partyPhoneToLines, parsePartyAddressFields } from '@/modules/commercial/quotations/lib/devisPartyUtils';

describe('parseDevisRow', () => {
  it('parses JSON string items and source references', () => {
    const row = {
      id: 42,
      type: 'vente',
      status: 'brouillon',
      devis_number: 'DEV-001',
      items: JSON.stringify([{ designation: 'Gants', quantity: 2, prix_ttc: 10 }]),
      total_amount: '120.5',
      is_bc: false,
      is_ba: false,
      is_bl: false,
      source_devis_id: 7,
      source_devis_ids: [7, 8],
      source_bc_id: 3,
      source_bc_ids: [3, 4],
      created_by: 'user-1',
      updated_by: 'user-2',
      attachment_urls: '[]',
    };

    const parsed = parseDevisRow(row, {
      'user-1': 'Alice',
      'user-2': 'Bob',
    }, { 7: 'DEV-007', 8: 'DEV-008' }, { 3: 'BC-003', 4: 'BC-004' });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.total_amount).toBe(120.5);
    expect(parsed.creator_name).toBe('Alice');
    expect(parsed.modifier_name).toBe('Bob');
    expect(parsed.source_devis_number).toBe('DEV-007, DEV-008');
    expect(parsed.source_bc_number).toBe('BC-003, BC-004');
    expect(parsed.attachment_urls).toEqual([]);
  });
});

describe('devisPartyUtils', () => {
  it('splits party phone display into lines', () => {
    expect(partyPhoneToLines('22 111 222 · 98 765 432')).toEqual(['22 111 222', '98 765 432']);
    expect(partyPhoneToLines('')).toEqual(['']);
  });

  it('parses party address into governorate fields', () => {
    expect(parsePartyAddressFields('Rue 1, Tunis, Tunis')).toEqual({
      exactLocation: 'Rue 1',
      city: 'Tunis',
      governorate: 'Tunis',
    });
    expect(parsePartyAddressFields('Sfax, Sfax')).toEqual({
      exactLocation: '',
      city: 'Sfax',
      governorate: 'Sfax',
    });
  });
});

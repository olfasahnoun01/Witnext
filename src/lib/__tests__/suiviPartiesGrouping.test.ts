import { describe, expect, it } from 'vitest';
import { groupSuiviBySociete, type SuiviPartiesRow } from '../suiviPartiesGrouping';

function row(partial: Partial<SuiviPartiesRow> & Pick<SuiviPartiesRow, 'id' | 'societe'>): SuiviPartiesRow {
  return {
    devis_date: null,
    devis_number: null,
    telephone: null,
    reponse: null,
    dernier_contact_date: null,
    ...partial,
  };
}

describe('groupSuiviBySociete', () => {
  it('groups multiple suivis under the same société', () => {
    const groups = groupSuiviBySociete([
      row({ id: 1, societe: 'ACME', devis_number: 'D-1' }),
      row({ id: 2, societe: 'acme', devis_number: 'D-2' }),
      row({ id: 3, societe: 'Beta SA', devis_number: 'D-3' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].societe).toBe('acme');
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[1].societe).toBe('Beta SA');
    expect(groups[1].entries).toHaveLength(1);
  });

  it('sorts groups by most recent activity', () => {
    const groups = groupSuiviBySociete([
      row({ id: 1, societe: 'Old Co', dernier_contact_date: '2024-01-01' }),
      row({ id: 2, societe: 'New Co', dernier_contact_date: '2026-06-01' }),
    ]);

    expect(groups[0].societe).toBe('New Co');
    expect(groups[1].societe).toBe('Old Co');
  });
});

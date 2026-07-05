import { describe, it, expect } from 'vitest';
import {
  filterBossEmployeeActivities,
  matchesBossDocTypeFilter,
  matchesBossNameFilter,
} from '@/lib/bossActivityFilters';
import { emptyCommercialDocCounts } from '@/lib/commercialDocKind';
import type { BossEmployeeActivity } from '@/services/bossCommercialService';

const sampleEmployees: BossEmployeeActivity[] = [
  {
    member: { userId: '1', fullName: 'Ali Ben Salah', email: 'ali@grosafe.tn' },
    counts: { ...emptyCommercialDocCounts(), DEVIS_CLIENT: 2 },
    documents: [
      {
        id: 1,
        devisNumber: 'D-1',
        devisDate: '2026-07-05',
        createdAt: '2026-07-05T10:00:00Z',
        kind: 'DEVIS_CLIENT',
        thirdPartyName: 'Client A',
        status: 'brouillon',
        totalAmount: 100,
        createdBy: '1',
      },
    ],
  },
  {
    member: { userId: '2', fullName: 'Sonia Trabelsi', email: 'sonia@grosafe.tn' },
    counts: { ...emptyCommercialDocCounts(), BC_CLIENT: 1 },
    documents: [
      {
        id: 2,
        devisNumber: 'BC-2',
        devisDate: '2026-07-05',
        createdAt: '2026-07-05T11:00:00Z',
        kind: 'BC_CLIENT',
        thirdPartyName: 'Client B',
        status: 'envoyé',
        totalAmount: 200,
        createdBy: '2',
      },
    ],
  },
];

describe('bossActivityFilters', () => {
  it('matches BC filter for both BC kinds', () => {
    expect(matchesBossDocTypeFilter('BC_CLIENT', 'BC')).toBe(true);
    expect(matchesBossDocTypeFilter('DEVIS_CLIENT', 'BC')).toBe(false);
  });

  it('filters by account name', () => {
    expect(matchesBossNameFilter({ fullName: 'Ali Ben Salah', email: 'ali@grosafe.tn' }, 'ali')).toBe(
      true
    );
    expect(matchesBossNameFilter({ fullName: 'Ali Ben Salah', email: 'ali@grosafe.tn' }, 'sonia')).toBe(
      false
    );
  });

  it('filters employees by name and type', () => {
    const byName = filterBossEmployeeActivities(sampleEmployees, { nameQuery: 'sonia', typeFilter: 'all' });
    expect(byName).toHaveLength(1);
    expect(byName[0].member.fullName).toBe('Sonia Trabelsi');

    const byBc = filterBossEmployeeActivities(sampleEmployees, { nameQuery: '', typeFilter: 'BC' });
    expect(byBc).toHaveLength(1);
    expect(byBc[0].documents[0].kind).toBe('BC_CLIENT');

    const byDevis = filterBossEmployeeActivities(sampleEmployees, { nameQuery: '', typeFilter: 'DEVIS_CLIENT' });
    expect(byDevis).toHaveLength(1);
    expect(byDevis[0].member.fullName).toBe('Ali Ben Salah');
  });
});

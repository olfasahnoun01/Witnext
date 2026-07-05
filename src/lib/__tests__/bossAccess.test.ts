import { describe, it, expect } from 'vitest';
import { canAccessBossDashboard, shouldAutoRedirectToBoss } from '@/lib/bossAccess';

describe('bossAccess', () => {
  it('allows directeur generale', () => {
    expect(
      canAccessBossDashboard({ isAdmin: false, isModerator: false, userPosition: 'Directeur Generale' })
    ).toBe(true);
  });

  it('allows admin', () => {
    expect(
      canAccessBossDashboard({ isAdmin: true, isModerator: false, userPosition: '' })
    ).toBe(true);
  });

  it('denies operateur', () => {
    expect(
      canAccessBossDashboard({ isAdmin: false, isModerator: false, userPosition: 'Operateur' })
    ).toBe(false);
  });

  it('auto-redirects only directeur generale', () => {
    expect(
      shouldAutoRedirectToBoss({ isAdmin: false, isModerator: false, userPosition: 'Directeur Generale' })
    ).toBe(true);
    expect(
      shouldAutoRedirectToBoss({ isAdmin: true, isModerator: false, userPosition: 'Directeur Generale' })
    ).toBe(false);
  });
});

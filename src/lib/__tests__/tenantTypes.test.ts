import { describe, expect, it, vi } from 'vitest';
import {
  isTrialActive,
  isValidSignupCompanyName,
  normalizeCompanyName,
  trialDaysRemaining,
  type TenantInfo,
} from '@/lib/tenantTypes';

const trialTenant: TenantInfo = {
  tenantId: 't1',
  tenantName: 'Acme',
  slug: 'acme',
  plan: 'trial',
  status: 'active',
  trialEndsAt: '2030-01-01T00:00:00.000Z',
  maxCompanies: 1,
  maxUsers: 3,
  memberRole: 'owner',
};

describe('tenantTypes', () => {
  it('normalizes company names', () => {
    expect(normalizeCompanyName('  Acme   SARL  ')).toBe('Acme SARL');
  });

  it('validates signup company name length', () => {
    expect(isValidSignupCompanyName('A')).toBe(false);
    expect(isValidSignupCompanyName('Acme')).toBe(true);
  });

  it('detects active trial', () => {
    expect(isTrialActive(trialTenant)).toBe(true);
    expect(isTrialActive({ ...trialTenant, plan: 'starter' })).toBe(false);
  });

  it('computes trial days remaining', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'));
    const days = trialDaysRemaining({
      ...trialTenant,
      trialEndsAt: '2026-07-11T12:00:00.000Z',
    });
    expect(days).toBe(2);
    vi.useRealTimers();
  });
});

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  trialEndsAt: string | null;
  maxCompanies: number;
  maxUsers: number;
  memberRole: 'owner' | 'admin' | 'member';
}

export interface ProvisionTenantResult {
  tenantId: string;
  companyId: string | null;
  slug: string;
  alreadyProvisioned: boolean;
}

export function isTrialActive(tenant: TenantInfo): boolean {
  if (tenant.plan !== 'trial') return false;
  if (!tenant.trialEndsAt) return true;
  return new Date(tenant.trialEndsAt).getTime() > Date.now();
}

export function trialDaysRemaining(tenant: TenantInfo): number | null {
  if (!tenant.trialEndsAt) return null;
  const ms = new Date(tenant.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function normalizeCompanyName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function isValidSignupCompanyName(input: string): boolean {
  return normalizeCompanyName(input).length >= 2;
}

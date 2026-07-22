export type TenantPlan = 'trial' | 'starter' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'cancelled';
export type TenantMemberRole = 'owner' | 'admin' | 'member';
export type TenantBillingCycle = 'monthly' | 'annual';

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  trialEndsAt: string | null;
  licenseStartsAt: string | null;
  licenseEndsAt: string | null;
  billingCycle: TenantBillingCycle | null;
  maxCompanies: number;
  maxUsers: number;
  memberRole: TenantMemberRole;
}

export interface TenantBillingReceipt {
  id: string;
  tenantId: string;
  numero: string;
  plan: TenantPlan;
  billingCycle: TenantBillingCycle | null;
  amountHt: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  notes: string | null;
}

export interface ProvisionTenantResult {
  tenantId: string;
  companyId: string | null;
  slug: string;
  alreadyProvisioned: boolean;
}

export const TENANT_PLAN_LABELS: Record<TenantPlan, string> = {
  trial: 'Essai',
  starter: 'Essentiel',
  pro: 'Pro',
  enterprise: 'Entreprise',
};

export const TENANT_BILLING_CYCLE_LABELS: Record<TenantBillingCycle, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
};

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

/** Paid license end date, or trial end when still on trial. */
export function licenseEndDate(tenant: TenantInfo): string | null {
  if (tenant.licenseEndsAt) return tenant.licenseEndsAt;
  if (tenant.plan === 'trial') return tenant.trialEndsAt;
  return null;
}

export function licenseDaysRemaining(tenant: TenantInfo): number | null {
  const end = licenseEndDate(tenant);
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isLicenseExpired(tenant: TenantInfo): boolean {
  const days = licenseDaysRemaining(tenant);
  return days !== null && days <= 0;
}

export function canViewTenantBilling(tenant: TenantInfo | null): boolean {
  if (!tenant) return false;
  return tenant.memberRole === 'owner' || tenant.memberRole === 'admin';
}

export function normalizeCompanyName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function isValidSignupCompanyName(input: string): boolean {
  return normalizeCompanyName(input).length >= 2;
}

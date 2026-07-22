import { supabase } from '@/integrations/supabase/client';
import type {
  ProvisionTenantResult,
  TenantBillingReceipt,
  TenantInfo,
  TenantPlan,
  TenantBillingCycle,
} from '@/lib/tenantTypes';

type GetMyTenantRow = {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  plan: TenantInfo['plan'];
  status: TenantInfo['status'];
  trial_ends_at: string | null;
  license_starts_at?: string | null;
  license_ends_at?: string | null;
  billing_cycle?: string | null;
  max_companies: number;
  max_users: number;
  member_role: TenantInfo['memberRole'];
};

function mapTenantRow(row: GetMyTenantRow): TenantInfo {
  const cycle = row.billing_cycle;
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    licenseStartsAt: row.license_starts_at ?? null,
    licenseEndsAt: row.license_ends_at ?? null,
    billingCycle:
      cycle === 'monthly' || cycle === 'annual' ? (cycle as TenantBillingCycle) : null,
    maxCompanies: row.max_companies,
    maxUsers: row.max_users,
    memberRole: row.member_role,
  };
}

export async function fetchMyTenant(): Promise<{
  ok: boolean;
  tenant: TenantInfo | null;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('get_my_tenant');
  if (error) return { ok: false, tenant: null, error: error.message };

  const row = (Array.isArray(data) ? data[0] : null) as GetMyTenantRow | null;
  if (!row) return { ok: true, tenant: null };
  return { ok: true, tenant: mapTenantRow(row) };
}

export async function provisionMyTenant(input: {
  companyName: string;
  fullName?: string;
}): Promise<{ ok: boolean; result?: ProvisionTenantResult; error?: string }> {
  const { data, error } = await supabase.rpc('provision_my_tenant', {
    p_company_name: input.companyName.trim(),
    p_full_name: input.fullName?.trim() || null,
  });

  if (error) {
    if (error.message.includes('company_name_required')) {
      return { ok: false, error: 'Le nom de la société est requis (2 caractères minimum).' };
    }
    if (error.message.includes('not_authenticated')) {
      return { ok: false, error: 'Session expirée. Reconnectez-vous puis réessayez.' };
    }
    return { ok: false, error: error.message };
  }

  const payload = data as {
    tenant_id: string;
    company_id: string | null;
    slug: string;
    already_provisioned: boolean;
  };

  return {
    ok: true,
    result: {
      tenantId: payload.tenant_id,
      companyId: payload.company_id,
      slug: payload.slug,
      alreadyProvisioned: payload.already_provisioned,
    },
  };
}

export function readPendingProvisioningMetadata(user: {
  user_metadata?: Record<string, unknown>;
}): { companyName?: string; fullName?: string } {
  const meta = user.user_metadata ?? {};
  const companyName =
    typeof meta.company_name === 'string' ? meta.company_name.trim() : undefined;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : undefined;
  return { companyName, fullName };
}

type ReceiptRow = {
  id: string;
  tenant_id: string;
  numero: string;
  plan: TenantPlan;
  billing_cycle: string | null;
  amount_ht: number | string;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  notes: string | null;
};

function mapReceipt(row: ReceiptRow): TenantBillingReceipt {
  const cycle = row.billing_cycle;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    numero: row.numero,
    plan: row.plan,
    billingCycle:
      cycle === 'monthly' || cycle === 'annual' ? (cycle as TenantBillingCycle) : null,
    amountHt: Number(row.amount_ht ?? 0),
    currency: row.currency || 'TND',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    issuedAt: row.issued_at,
    notes: row.notes,
  };
}

export async function fetchMyBillingReceipts(): Promise<{
  ok: boolean;
  receipts: TenantBillingReceipt[];
  error?: string;
}> {
  const tenantResult = await fetchMyTenant();
  if (!tenantResult.ok) {
    return { ok: false, receipts: [], error: tenantResult.error };
  }
  if (!tenantResult.tenant) {
    return { ok: true, receipts: [] };
  }

  const { data, error } = await supabase
    .from('tenant_billing_receipts')
    .select(
      'id, tenant_id, numero, plan, billing_cycle, amount_ht, currency, period_start, period_end, issued_at, notes'
    )
    .eq('tenant_id', tenantResult.tenant.tenantId)
    .order('issued_at', { ascending: false });

  if (error) return { ok: false, receipts: [], error: error.message };
  return {
    ok: true,
    receipts: ((data ?? []) as ReceiptRow[]).map(mapReceipt),
  };
}

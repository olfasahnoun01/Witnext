import { supabase } from '@/integrations/supabase/client';

export type PlatformTenantRow = {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  trialEndsAt: string | null;
  maxCompanies: number;
  maxUsers: number;
  createdAt: string;
  companyCount: number;
  memberCount: number;
};

type RpcTenantRow = {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  plan: PlatformTenantRow['plan'];
  status: PlatformTenantRow['status'];
  trial_ends_at: string | null;
  max_companies: number;
  max_users: number;
  created_at: string;
  company_count: number | string;
  member_count: number | string;
};

function mapRow(row: RpcTenantRow): PlatformTenantRow {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    maxCompanies: row.max_companies,
    maxUsers: row.max_users,
    createdAt: row.created_at,
    companyCount: Number(row.company_count ?? 0),
    memberCount: Number(row.member_count ?? 0),
  };
}

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) {
    console.warn('[platform] is_platform_admin:', error.message);
    return false;
  }
  return !!data;
}

export async function listPlatformTenants(): Promise<{
  ok: boolean;
  tenants: PlatformTenantRow[];
  error?: string;
}> {
  const { data, error } = await supabase.rpc('platform_list_tenants');
  if (error) {
    if (error.message.includes('platform_admin_required')) {
      return { ok: false, tenants: [], error: 'Accès réservé aux administrateurs plateforme.' };
    }
    return { ok: false, tenants: [], error: error.message };
  }
  const rows = (Array.isArray(data) ? data : []) as RpcTenantRow[];
  return { ok: true, tenants: rows.map(mapRow) };
}

export async function setPlatformTenantStatus(
  tenantId: string,
  status: PlatformTenantRow['status']
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('platform_set_tenant_status', {
    p_tenant_id: tenantId,
    p_status: status,
  });
  if (error) {
    if (error.message.includes('platform_admin_required')) {
      return { ok: false, error: 'Accès réservé aux administrateurs plateforme.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function createTenantWithOwner(input: {
  companyName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerFullName?: string;
  plan?: PlatformTenantRow['plan'];
  maxCompanies?: number;
  maxUsers?: number;
  trialDays?: number;
}): Promise<{
  ok: boolean;
  tenantId?: string;
  companyId?: string;
  slug?: string;
  ownerUserId?: string;
  error?: string;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: {
      action: 'create_tenant',
      company_name: input.companyName.trim(),
      owner_email: input.ownerEmail.trim().toLowerCase(),
      owner_password: input.ownerPassword,
      owner_full_name: input.ownerFullName?.trim() || '',
      plan: input.plan ?? 'trial',
      max_companies: input.maxCompanies ?? 1,
      max_users: input.maxUsers ?? 5,
      trial_days: input.trialDays ?? 14,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: String(data.error) };

  return {
    ok: true,
    tenantId: data?.tenant_id,
    companyId: data?.company_id,
    slug: data?.slug,
    ownerUserId: data?.owner_user_id,
  };
}

import { supabase } from '@/integrations/supabase/client';
import type { ProvisionTenantResult, TenantInfo } from '@/lib/tenantTypes';

type GetMyTenantRow = {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  plan: TenantInfo['plan'];
  status: TenantInfo['status'];
  trial_ends_at: string | null;
  max_companies: number;
  max_users: number;
  member_role: TenantInfo['memberRole'];
};

function mapTenantRow(row: GetMyTenantRow): TenantInfo {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
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

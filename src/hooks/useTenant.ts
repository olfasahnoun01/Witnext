import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ensureSupabaseSessionReady, supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import {
  fetchMyTenant,
  provisionMyTenant,
  readPendingProvisioningMetadata,
} from '@/lib/tenantService';
import type { TenantInfo } from '@/lib/tenantTypes';

export function useTenant() {
  const { user, session, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const sessionReady = !authLoading && !!userId && !!session?.access_token;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setTenant(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const ready = await ensureSupabaseSessionReady(12_000);
    if (!ready) {
      setLoadError('Session non prête. Réessayez.');
      setLoading(false);
      return;
    }

    const result = await supabaseQueryWithAuthRetry(() => fetchMyTenant());
    if (!result.ok) {
      setTenant(null);
      setLoadError(result.error ?? 'Impossible de charger votre organisation.');
      setLoading(false);
      return;
    }

    setTenant(result.tenant);
    setLoadError(null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!sessionReady) {
      if (!authLoading && !userId) {
        setTenant(null);
        setLoadError(null);
        setLoading(false);
      }
      return;
    }
    void load();
  }, [sessionReady, authLoading, userId, load]);

  const ensureProvisioned = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!user) return { ok: false, error: 'Non connecté' };

    const current = await fetchMyTenant();
    if (current.tenant) {
      setTenant(current.tenant);
      return { ok: true };
    }

    const { companyName, fullName } = readPendingProvisioningMetadata(user);
    if (!companyName || companyName.length < 2) {
      return { ok: false, error: 'missing_company_metadata' };
    }

    const provisioned = await provisionMyTenant({ companyName, fullName });
    if (!provisioned.ok) {
      return { ok: false, error: provisioned.error };
    }

    await load();
    return { ok: true };
  }, [user, load]);

  return {
    tenant,
    loading,
    loadError,
    reload: load,
    ensureProvisioned,
  };
}

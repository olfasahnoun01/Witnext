import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { useTenant } from '@/hooks/useTenant';
import { BootstrapErrorPanel } from '@/components/layout/BootstrapErrorPanel';

/**
 * Ensures authenticated users belong to a tenant (or legacy company assignment)
 * before entering the ERP shell.
 */
export function TenantBootstrapGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authLoading, isPlatformAdmin, rolesReady } = useAuth();
  const { companies, loading: companyLoading, reload: reloadCompanies } = useAppCompany();
  const { tenant, loading: tenantLoading, loadError, ensureProvisioned, reload } = useTenant();
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const tryProvision = useCallback(async () => {
    setProvisioning(true);
    setProvisionError(null);
    try {
      const result = await ensureProvisioned();
      if (result.ok) {
        await reloadCompanies();
        return;
      }
      if (result.error === 'missing_company_metadata') {
        setProvisionError('missing_company_metadata');
      } else {
        setProvisionError(result.error ?? 'Provisionnement impossible.');
      }
    } finally {
      setProvisioning(false);
    }
  }, [ensureProvisioned, reloadCompanies]);

  useEffect(() => {
    if (authLoading || !rolesReady || tenantLoading || companyLoading || !session) return;
    if (isPlatformAdmin) return;
    if (tenant || companies.length > 0) return;
    void tryProvision();
  }, [
    authLoading,
    rolesReady,
    tenantLoading,
    companyLoading,
    session,
    isPlatformAdmin,
    tenant,
    companies.length,
    tryProvision,
  ]);

  if (authLoading || !rolesReady || tenantLoading || companyLoading || provisioning) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Platform operators can open the console without belonging to a customer tenant.
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  if (loadError) {
    return (
      <BootstrapErrorPanel
        message={loadError}
        onRetry={() => void reload()}
        retrying={false}
      />
    );
  }

  if (provisionError === 'missing_company_metadata') {
    return <Navigate to="/signup" replace />;
  }

  if (provisionError) {
    return (
      <BootstrapErrorPanel
        message={provisionError}
        onRetry={() => void tryProvision()}
        retrying={provisioning}
      />
    );
  }

  if (!tenant && companies.length === 0) {
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}

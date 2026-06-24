import { Loader2 } from 'lucide-react';
import {
  COMPANY_DISPLAY_NAMES,
  COMPANY_SCOPED_SUBSECTIONS,
  SUBSECTION_LABELS,
  isSubsectionVisibleForCompany,
} from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { BootstrapErrorPanel } from '@/components/layout/BootstrapErrorPanel';
import { useCallback, useState } from 'react';

export const RouteLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export const AccessDenied = () => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center p-12 text-center text-muted-foreground">
    <p className="text-lg font-medium text-foreground">Accès non autorisé</p>
    <p className="mt-2 text-sm">Vous n&apos;avez pas la permission d&apos;accéder à cette section.</p>
  </div>
);

export const CompanyScopeDenied = ({ subsectionId }: { subsectionId: string }) => {
  const required = COMPANY_SCOPED_SUBSECTIONS[subsectionId];
  const label = required ? (COMPANY_DISPLAY_NAMES[required] ?? required) : '';
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center p-12 text-center text-muted-foreground">
      <p className="text-lg font-medium text-foreground">Section non disponible</p>
      <p className="mt-2 max-w-md text-sm">
        {SUBSECTION_LABELS[subsectionId] ?? subsectionId} est réservé à la société{' '}
        <strong>{label}</strong>. Changez de société via le sélecteur en haut de l&apos;écran.
      </p>
    </div>
  );
};

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const {
    loading: permissionsLoading,
    loadError: permissionsLoadError,
    reload: reloadPermissions,
  } = usePermissions();
  const {
    loading: companyLoading,
    loadError: companyLoadError,
    reload: reloadCompany,
  } = useAppCompany();
  const [retrying, setRetrying] = useState(false);

  const bootstrapLoading = permissionsLoading || companyLoading;
  const bootstrapError = permissionsLoadError || companyLoadError;

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await Promise.all([reloadPermissions(), reloadCompany()]);
    } finally {
      setRetrying(false);
    }
  }, [reloadPermissions, reloadCompany]);

  if (bootstrapLoading) return <RouteLoader />;

  if (bootstrapError) {
    return (
      <BootstrapErrorPanel
        message={bootstrapError}
        onRetry={() => void handleRetry()}
        retrying={retrying}
      />
    );
  }

  return <>{children}</>;
}

interface SubsectionRouteProps {
  subsectionId: string;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

export function SubsectionRoute({ subsectionId, requireAdmin, children }: SubsectionRouteProps) {
  const { isAdmin } = useAuth();
  const { canAccessSubsection } = usePermissions();
  const { currentCompany } = useAppCompany();

  const isPublic =
    subsectionId === 'dashboard' || subsectionId === 'team-chat' || subsectionId === 'messages';

  if (requireAdmin && !isAdmin) {
    return <AccessDenied />;
  }

  if (!isPublic && !canAccessSubsection(subsectionId)) {
    return <AccessDenied />;
  }

  if (!isPublic && !isSubsectionVisibleForCompany(subsectionId, currentCompany?.code)) {
    return <CompanyScopeDenied subsectionId={subsectionId} />;
  }

  return <>{children}</>;
}

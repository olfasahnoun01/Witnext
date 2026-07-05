import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { AccessDenied } from '@/router/RouteGuards';
import {
  canAccessBossDashboard,
  getUserPositionFromMetadata,
} from '@/lib/bossAccess';
import { BossCommercialDashboard } from '@/pages/boss/BossCommercialDashboard';
import { BossEmployeeDetail } from '@/pages/boss/BossEmployeeDetail';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';

export function BossLayout() {
  const { user, isAdmin, isModerator, isLoading: authLoading } = useAuth();
  const { loading: companyLoading } = useAppCompany();

  const position = getUserPositionFromMetadata(user);
  const allowed = canAccessBossDashboard({ isAdmin, isModerator, userPosition: position });

  if (authLoading || companyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <AccessDenied />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md safe-area-top">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-3">
          <WitnextLogoBanner className="h-8 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Suivi commercial</p>
            <p className="truncate text-xs text-muted-foreground">Vue direction</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <Routes>
          <Route index element={<BossCommercialDashboard />} />
          <Route path="employee/:userId" element={<BossEmployeeDetail />} />
          <Route path="*" element={<Navigate to="/boss" replace />} />
        </Routes>
      </main>
    </div>
  );
}

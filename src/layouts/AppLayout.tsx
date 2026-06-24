import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TeamChatProvider } from '@/components/TeamChat';
import { AppLayoutProvider } from '@/contexts/AppLayoutContext';
import { ErpRoutes } from '@/router/ErpRoutes';
import { cn } from '@/lib/utils';
import {
  getPageTitle,
  getPathForSubsection,
  getSubsectionFromPath,
  ROUTE_PREFETCH_BY_SUBSECTION,
} from '@/config/routes';
import { isSubsectionVisibleForCompany } from '@/config/navigation';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { readStoredActiveTab } from '@/lib/appNavigationStorage';

const LEGACY_ROUTE_MIGRATION_KEY = 'grosafe_legacy_tab_route_migrated';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentCompany, loading: companyLoading } = useAppCompany();
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const legacyMigrationDone = useRef(false);

  const pathname = location.pathname;
  const subsectionId = getSubsectionFromPath(pathname);
  const isMessages = pathname === '/messages' || subsectionId === 'team-chat';
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    if (legacyMigrationDone.current) return;
    legacyMigrationDone.current = true;

    try {
      if (sessionStorage.getItem(LEGACY_ROUTE_MIGRATION_KEY)) return;
      const legacyTab = readStoredActiveTab('');
      if (!legacyTab || legacyTab === 'dashboard') {
        sessionStorage.setItem(LEGACY_ROUTE_MIGRATION_KEY, '1');
        return;
      }
      const target = getPathForSubsection(legacyTab);
      if (target && target !== '/dashboard' && pathname === '/dashboard') {
        navigate(target, { replace: true });
      }
      sessionStorage.setItem(LEGACY_ROUTE_MIGRATION_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }, [navigate, pathname]);

  useEffect(() => {
    if (companyLoading) return;
    if (!subsectionId || subsectionId === 'dashboard' || subsectionId === 'team-chat') return;
    if (!isSubsectionVisibleForCompany(subsectionId, currentCompany?.code)) {
      navigate('/dashboard', { replace: true });
    }
  }, [companyLoading, currentCompany?.code, subsectionId, navigate]);

  useEffect(() => {
    if (!subsectionId) return;
    const prefetch = ROUTE_PREFETCH_BY_SUBSECTION[subsectionId];
    if (!prefetch) return;

    const useIdleCallback = typeof window.requestIdleCallback === 'function';
    const id = useIdleCallback
      ? window.requestIdleCallback(prefetch)
      : window.setTimeout(prefetch, 1000);

    return () => {
      if (useIdleCallback && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [subsectionId]);

  return (
    <TeamChatProvider isPageOpen={isMessages}>
      <AppLayoutProvider sidebarOpen={sidebarOpen}>
        <div className="flex min-h-screen flex-col bg-background">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col transition-all duration-300',
              sidebarOpen ? 'lg:ml-72' : 'lg:ml-0'
            )}
          >
            <Header
              title={pageTitle}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              sidebarOpen={sidebarOpen}
            />
            <main
              className={cn(
                'flex min-h-0 flex-1 flex-col',
                isMessages ? 'overflow-hidden p-3 sm:p-4' : 'p-6'
              )}
            >
              <ErpRoutes />
            </main>
          </div>
        </div>
      </AppLayoutProvider>
    </TeamChatProvider>
  );
}

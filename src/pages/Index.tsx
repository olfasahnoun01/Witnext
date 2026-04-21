import { useState, useCallback, lazy, Suspense, useTransition, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';
import { ComingSoon } from '@/components/ComingSoon';
import { BIG_SECTIONS, SUBSECTION_LABELS } from '@/config/navigation';
import { usePermissions } from '@/hooks/usePermissions';

// Eagerly import Dashboard since it's the default view
import { Dashboard } from '@/components/Dashboard';

// Lazy load all other tabs
const Inventory = lazy(() => import('@/components/Inventory').then(m => ({ default: m.Inventory })));
const Transactions = lazy(() => import('@/components/Transactions').then(m => ({ default: m.Transactions })));
const Reports = lazy(() => import('@/components/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('@/components/Settings').then(m => ({ default: m.Settings })));
const SupplierComparison = lazy(() => import('@/components/SupplierComparison').then(m => ({ default: m.SupplierComparison })));
const Fournisseurs = lazy(() => import('@/components/Fournisseurs').then(m => ({ default: m.Fournisseurs })));
const Clients = lazy(() => import('@/components/Clients').then(m => ({ default: m.Clients })));
const GestionDevis = lazy(() => import('@/components/GestionDevis').then(m => ({ default: m.GestionDevis })));
const PhotoGallery = lazy(() => import('@/components/PhotoGallery').then(m => ({ default: m.PhotoGallery })));
const EmployeeList = lazy(() => import('@/components/EmployeeList').then(m => ({ default: m.EmployeeList })));
const Flotte = lazy(() => import('@/components/Flotte').then(m => ({ default: m.Flotte })));

// Sub-sections that show a "Coming Soon" placeholder
const COMING_SOON_TABS = new Set([
  'rdv',
  'suivi-clients',
  'suivi-fournisseurs',
  'planning',
  'gestion-vehicules',
]);

const ComponentLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { canAccessSubsection, firstAllowedSubsection, visibleSections, loading: permsLoading } = usePermissions();

  const handleTabChange = useCallback((tab: string) => {
    startTransition(() => setActiveTab(tab));
  }, []);

  // After permissions load, redirect to first allowed view if current is denied
  useEffect(() => {
    if (permsLoading) return;
    if (activeTab === 'settings') return;
    if (activeTab.startsWith('section:')) return;

    if (!canAccessSubsection(activeTab)) {
      // Try first visible section's first allowed sub-section
      for (const sec of visibleSections) {
        const sub = firstAllowedSubsection(sec.id);
        if (sub) {
          setActiveTab(sub);
          return;
        }
        // Empty section -> show its placeholder
        if (sec.subsections.length === 0) {
          setActiveTab(`section:${sec.id}`);
          return;
        }
      }
      // Nothing accessible -> settings
      setActiveTab('settings');
    }
  }, [permsLoading, activeTab, canAccessSubsection, firstAllowedSubsection, visibleSections]);

  const title = useMemo(() => {
    if (activeTab === 'settings') return 'Paramètres';
    if (activeTab.startsWith('section:')) {
      const id = activeTab.replace('section:', '');
      return BIG_SECTIONS.find((s) => s.id === id)?.label ?? '';
    }
    return SUBSECTION_LABELS[activeTab] ?? '';
  }, [activeTab]);

  const renderContent = () => {
    if (activeTab === 'settings') {
      return (
        <Suspense fallback={<ComponentLoader />}>
          <Settings />
        </Suspense>
      );
    }

    if (activeTab.startsWith('section:')) {
      const id = activeTab.replace('section:', '');
      const section = BIG_SECTIONS.find((s) => s.id === id);
      return <ComingSoon sectionLabel={section?.label ?? 'Section'} />;
    }

    // Coming-soon sub-sections
    if (COMING_SOON_TABS.has(activeTab)) {
      return <ComingSoon sectionLabel={SUBSECTION_LABELS[activeTab] ?? 'Section'} />;
    }

    if (activeTab === 'dashboard') return <Dashboard />;

    return (
      <Suspense fallback={<ComponentLoader />}>
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'fournisseurs' && <Fournisseurs />}
        {activeTab === 'clients' && <Clients />}
        {activeTab === 'comparison' && <SupplierComparison />}
        {activeTab === 'transactions' && <Transactions />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'devis' && <GestionDevis onTabChange={handleTabChange} />}
        {activeTab === 'ba' && <GestionDevis onTabChange={handleTabChange} initialSection="ba" initialDocType="ba" />}
        {activeTab === 'gallery' && <PhotoGallery />}
        {activeTab === 'employees' && <EmployeeList />}
        {activeTab === 'flotte' && <Flotte />}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="lg:ml-80">
        <Header title={title} />
        <main className="p-6">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Index;

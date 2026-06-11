import { useState, useCallback, lazy, Suspense, useTransition, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';
import {
  COMPANY_DISPLAY_NAMES,
  COMPANY_SCOPED_SUBSECTIONS,
  SUBSECTION_LABELS,
  isSubsectionVisibleForCompany,
} from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { AppLayoutProvider } from '@/contexts/AppLayoutContext';
import { AppCompanyProvider, useAppCompany } from '@/contexts/AppCompanyContext';
import { BootstrapErrorPanel } from '@/components/layout/BootstrapErrorPanel';

// Eagerly import Dashboard since it's the default view
import { Dashboard } from '@/components/Dashboard';

// Lazy load all other tabs - they load on demand
const Inventory = lazy(() => import('@/components/Inventory').then(m => ({ default: m.Inventory })));
const Transactions = lazy(() => import('@/components/Transactions').then(m => ({ default: m.Transactions })));
const Reports = lazy(() => import('@/components/Reports').then(m => ({ default: m.Reports })));

const Settings = lazy(() => import('@/components/Settings').then(m => ({ default: m.Settings })));
const SupplierComparison = lazy(() => import('@/components/SupplierComparison').then(m => ({ default: m.SupplierComparison })));
const Fournisseurs = lazy(() => import('@/components/Fournisseurs').then(m => ({ default: m.Fournisseurs })));
const Clients = lazy(() => import('@/components/Clients').then(m => ({ default: m.Clients })));

const GestionDevis = lazy(() => import('@/components/GestionDevis').then(m => ({ default: m.GestionDevis })));
const PhotoGallery = lazy(() => import('@/components/PhotoGallery').then(m => ({ default: m.PhotoGallery })));
const UnifiedDocumentList = lazy(() => import('@/components/devis/UnifiedDocumentList').then(m => ({ default: m.UnifiedDocumentList })));
const PurchaseRequestManager = lazy(() => import('@/components/devis/PurchaseRequestManager').then(m => ({ default: m.PurchaseRequestManager })));
const WarehouseDocumentManager = lazy(() => import('@/components/inventory/WarehouseDocumentManager').then(m => ({ default: m.WarehouseDocumentManager })));

const Planning = lazy(() => import('@/components/Planning').then(m => ({ default: m.Planning })));
const DriverControlPlanning = lazy(() =>
  import('@/components/rh/DriverControlPlanning').then((m) => ({ default: m.DriverControlPlanning }))
);
const RhRapports = lazy(() => import('@/components/rh/RhRapports').then(m => ({ default: m.RhRapports })));
const RhStatistiques = lazy(() => import('@/components/rh/RhStatistiques').then(m => ({ default: m.RhStatistiques })));
const HrEmployeesHub = lazy(() => import('@/components/rh/HrEmployeesHub').then(m => ({ default: m.HrEmployeesHub })));
const Flotte = lazy(() => import('@/components/Flotte').then(m => ({ default: m.Flotte })));
const VehiculeStats = lazy(() => import('@/components/vehicules/VehiculeStats').then(m => ({ default: m.VehiculeStats })));
const BonCarburant = lazy(() => import('@/components/vehicules/BonCarburant').then(m => ({ default: m.BonCarburant })));
const CartesCarburant = lazy(() => import('@/components/vehicules/CartesCarburant').then(m => ({ default: m.CartesCarburant })));
const Maintenance = lazy(() => import('@/components/vehicules/Maintenance').then(m => ({ default: m.Maintenance })));
const ChargesVehicule = lazy(() => import('@/components/vehicules/ChargesVehicule').then(m => ({ default: m.ChargesVehicule })));
const ComingSoon = lazy(() => import('@/components/ComingSoon').then(m => ({ default: m.ComingSoon })));
const FluxSuiviHub = lazy(() =>
  import('@/modules/flux/components/FluxSuiviHub').then((m) => ({ default: m.FluxSuiviHub }))
);
const PermissionsManager = lazy(() => import('@/components/PermissionsManager').then(m => ({ default: m.PermissionsManager })));
const RDV = lazy(() => import('@/components/commercial/RDV').then(m => ({ default: m.RDV })));
const TeamChat = lazy(() => import('@/components/TeamChat').then(m => ({ default: m.TeamChat })));
const FacturesVente = lazy(() => import('@/components/commercial/FacturesVente').then(m => ({ default: m.FacturesVente })));
const FinanceModule = lazy(() => import('@/modules/finance/FinanceModule').then(m => ({ default: m.FinanceModule })));

// Prefetch map: when user is on tab X, prefetch tab Y
const prefetchMap: Record<string, () => void> = {
  dashboard: () => { import('@/components/Inventory'); },
  inventory: () => { import('@/components/Transactions'); import('@/components/Fournisseurs'); },
  fournisseurs: () => { import('@/components/SupplierComparison'); },
  transactions: () => { import('@/components/Reports'); },
};

const ComponentLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const AccessDenied = () => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center p-12 text-center text-muted-foreground">
    <p className="text-lg font-medium text-foreground">Accès non autorisé</p>
    <p className="mt-2 text-sm">Vous n&apos;avez pas la permission d&apos;accéder à cette section.</p>
  </div>
);

const CompanyScopeDenied = ({ subsectionId }: { subsectionId: string }) => {
  const required = COMPANY_SCOPED_SUBSECTIONS[subsectionId];
  const label = required ? COMPANY_DISPLAY_NAMES[required] ?? required : '';
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center p-12 text-center text-muted-foreground">
      <p className="text-lg font-medium text-foreground">Section non disponible</p>
      <p className="mt-2 text-sm max-w-md">
        {SUBSECTION_LABELS[subsectionId] ?? subsectionId} est réservé à la société{' '}
        <strong>{label}</strong>. Changez de société via le sélecteur en haut de l&apos;écran.
      </p>
    </div>
  );
};

const IndexContent = () => {
  const { isAdmin, session } = useAuth();
  const {
    canAccessSubsection,
    loading: permissionsLoading,
    loadError: permissionsLoadError,
    reload: reloadPermissions,
  } = usePermissions();
  const {
    currentCompany,
    loading: companyLoading,
    loadError: companyLoadError,
    reload: reloadCompany,
  } = useAppCompany();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [bootstrapRetrying, setBootstrapRetrying] = useState(false);
  const [, startTransition] = useTransition();

  const bootstrapLoading = permissionsLoading || companyLoading;
  const bootstrapError = permissionsLoadError || companyLoadError;

  const handleBootstrapRetry = useCallback(async () => {
    setBootstrapRetrying(true);
    try {
      await Promise.all([reloadPermissions(), reloadCompany()]);
    } finally {
      setBootstrapRetrying(false);
    }
  }, [reloadPermissions, reloadCompany]);

  // Prefetch likely next tabs after idle
  useEffect(() => {
    const prefetch = prefetchMap[activeTab];
    if (prefetch) {
      const id = requestIdleCallback ? requestIdleCallback(prefetch) : setTimeout(prefetch, 1000);
      return () => {
        if (typeof id === 'number' && 'cancelIdleCallback' in window) {
          cancelIdleCallback(id);
        } else {
          clearTimeout(id as any);
        }
      };
    }
  }, [activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  }, []);

  useEffect(() => {
    if (companyLoading) return;
    if (!isSubsectionVisibleForCompany(activeTab, currentCompany?.code)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, companyLoading, currentCompany?.code]);

  const renderContent = () => {
    if (bootstrapLoading) {
      return <ComponentLoader />;
    }

    if (bootstrapError) {
      return (
        <BootstrapErrorPanel
          message={bootstrapError}
          onRetry={() => void handleBootstrapRetry()}
          retrying={bootstrapRetrying}
        />
      );
    }

    if (activeTab !== 'dashboard' && !canAccessSubsection(activeTab)) {
      return <AccessDenied />;
    }

    if (
      activeTab !== 'dashboard' &&
      !isSubsectionVisibleForCompany(activeTab, currentCompany?.code)
    ) {
      return <CompanyScopeDenied subsectionId={activeTab} />;
    }

    if (activeTab === 'dashboard') {
      return (
        <ErrorBoundary title="Erreur du tableau de bord">
          <Dashboard key={session?.user?.id ?? 'guest'} />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
      <Suspense fallback={<ComponentLoader />}>
        {/* Magasin & Stock */}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'be-magasin' && (
          <WarehouseDocumentManager 
            type="BE" 
            title="Bons d'Entrée" 
            description="Gérez les réceptions de stock et entrées manuelles." 
          />
        )}
        {activeTab === 'bs-magasin' && (
          <WarehouseDocumentManager 
            type="BS" 
            title="Bons de Sortie" 
            description="Gérez les sorties de stock manuelles." 
          />
        )}
        {activeTab === 'bl-magasin' && (
          <WarehouseDocumentManager 
            type="BL_CLIENT" 
            title="Bons de Livraison (Magasin)" 
            description="Gérez les livraisons créées directement depuis le magasin." 
          />
        )}
        {activeTab === 'comparison' && <SupplierComparison />}
        {activeTab === 'transactions' && <Transactions />}
        {activeTab === 'reports' && <Reports />}
        
        {/* Commerciale */}
        {activeTab === 'commerciale-clients' && <Clients />}
        {activeTab === 'devis-vente' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="history" initialDevisType="vente" lockDevisType sectionMode="devis" />
        )}
        {activeTab === 'bc-vente' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="bc" initialDevisType="vente" sectionMode="bc" />
        )}
        {activeTab === 'bl-vente' && (
          <GestionDevis
            onTabChange={handleTabChange}
            initialSection="bl"
            initialDevisType="vente"
            lockDevisType
            sectionMode="bl"
          />
        )}
        {activeTab === 'factures-vente' && (
          <Suspense fallback={<ComponentLoader />}>
            <FacturesVente />
          </Suspense>
        )}
        {activeTab === 'flux-suivi' && (
          <Suspense fallback={<ComponentLoader />}>
            <FluxSuiviHub />
          </Suspense>
        )}
        {(activeTab === 'flux-suivi-magasin' || activeTab === 'suivi-clients' || activeTab === 'suivi-fournisseurs') && (
          <Suspense fallback={<ComponentLoader />}>
            <FluxSuiviHub />
          </Suspense>
        )}

        {activeTab === 'bc-fournisseur-reception' && (
          <Suspense fallback={<ComponentLoader />}>
            <UnifiedDocumentList
              title="Réception fournisseurs"
              description="BC fournisseur en attente de réception — saisir les quantités reçues et valider les bons d'entrée."
              documentTypes={['BC_FOURNISSEUR']}
            />
          </Suspense>
        )}
        {activeTab === 'gallery' && <PhotoGallery />}
        {activeTab === 'rdv' && <RDV />}

        {(activeTab === 'demande-achat' || activeTab === 'demande-achat-magasin') && <PurchaseRequestManager />}
        {activeTab === 'commerciale-fournisseurs' && <Fournisseurs />}
        {activeTab === 'devis-achat' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="history" initialDevisType="achat" lockDevisType sectionMode="devis" />
        )}
        {activeTab === 'bc-achat' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="bc" initialDevisType="achat" lockDevisType sectionMode="bc" />
        )}
        {/* Commercial */}
        {activeTab === 'rh-employes' && <HrEmployeesHub />}
        {activeTab === 'planning' && <Planning />}
        {activeTab === 'rh-planning-controle' && <DriverControlPlanning />}
        {activeTab === 'rh-rapports' && <RhRapports />}
        {activeTab === 'rh-statistiques' && <RhStatistiques />}
        
        {/* Véhicules */}
        {activeTab === 'flotte' && <Flotte initialSection="flotte" />}
        {activeTab === 'vehicules-status' && <Flotte initialSection="status" />}
        {activeTab === 'vehicules-stats' && <VehiculeStats />}
        {activeTab === 'vehicules-bons' && <BonCarburant />}
        {activeTab === 'vehicules-cartes' && <CartesCarburant />}
        {activeTab === 'vehicules-maintenance' && <Maintenance />}
        {activeTab === 'vehicules-charges' && <ChargesVehicule />}
        
        {/* Administration */}
        {activeTab === 'accounts' && (
          isAdmin ? <PermissionsManager /> : <div className="p-12 text-center text-muted-foreground font-medium">Accès réservé aux administrateurs</div>
        )}
        {activeTab === 'settings' && <Settings />}

        {activeTab === 'finance-hub' && <FinanceModule />}
      </Suspense>
      </ErrorBoundary>
    );
  };

  return (
    <AppLayoutProvider sidebarOpen={sidebarOpen}>
      <div className="min-h-screen bg-background">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className={cn('transition-all duration-300', sidebarOpen ? 'lg:ml-72' : 'lg:ml-0')}>
          <Header
            title={SUBSECTION_LABELS[activeTab] || 'Alpha'}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            onNavigateTab={handleTabChange}
          />
          <main className="p-6">
            {renderContent()}
          </main>
        </div>

        <Suspense fallback={null}>
          <TeamChat />
        </Suspense>
      </div>
    </AppLayoutProvider>
  );
};

const Index = () => (
  <AppCompanyProvider>
    <IndexContent />
  </AppCompanyProvider>
);

export default Index;

import { useState, useCallback, lazy, Suspense, useTransition, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';
import { SUBSECTION_LABELS } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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
const EmployeeList = lazy(() => import('@/components/EmployeeList').then(m => ({ default: m.EmployeeList })));
const Flotte = lazy(() => import('@/components/Flotte').then(m => ({ default: m.Flotte })));
const VehiculeStats = lazy(() => import('@/components/vehicules/VehiculeStats').then(m => ({ default: m.VehiculeStats })));
const BonCarburant = lazy(() => import('@/components/vehicules/BonCarburant').then(m => ({ default: m.BonCarburant })));
const CartesCarburant = lazy(() => import('@/components/vehicules/CartesCarburant').then(m => ({ default: m.CartesCarburant })));
const Maintenance = lazy(() => import('@/components/vehicules/Maintenance').then(m => ({ default: m.Maintenance })));
const ChargesVehicule = lazy(() => import('@/components/vehicules/ChargesVehicule').then(m => ({ default: m.ChargesVehicule })));
const ComingSoon = lazy(() => import('@/components/ComingSoon').then(m => ({ default: m.ComingSoon })));
const SuiviManager = lazy(() => import('@/components/commercial/SuiviManager').then(m => ({ default: m.SuiviManager })));
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

const Index = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [, startTransition] = useTransition();

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

  const renderContent = () => {
    // Dashboard is eagerly loaded - no Suspense needed
    if (activeTab === 'dashboard') return <Dashboard />;

    return (
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
          <UnifiedDocumentList
            title="Bons de Livraison"
            description="Suivez les bons de livraison générés depuis le magasin."
            documentTypes={['BL_CLIENT']}
            metadataFilter={{ key: 'origin', value: 'magasin' }}
          />
        )}
        {activeTab === 'factures-vente' && (
          <Suspense fallback={<ComponentLoader />}>
            <FacturesVente />
          </Suspense>
        )}
        {activeTab === 'suivi-clients' && <SuiviManager type="client" />}
        {/* Galerie commerciale (Ventes) */}
        {activeTab === 'gallery' && <PhotoGallery />}
        
        {(activeTab === 'demande-achat' || activeTab === 'demande-achat-magasin') && <PurchaseRequestManager />}
        {activeTab === 'commerciale-fournisseurs' && <Fournisseurs />}
        {activeTab === 'devis-achat' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="history" initialDevisType="achat" lockDevisType sectionMode="devis" />
        )}
        {activeTab === 'bc-achat' && (
          <GestionDevis onTabChange={handleTabChange} initialSection="bc" initialDevisType="achat" lockDevisType sectionMode="bc" />
        )}
        {activeTab === 'suivi-fournisseurs' && <SuiviManager type="fournisseur" />}
        
        {activeTab === 'rdv' && <RDV />}
        
        {/* Ressources Humaines */}
        {activeTab === 'planning' && <Planning />}
        {activeTab === 'employees' && <EmployeeList />}
        
        {/* Véhicules */}
        {activeTab === 'flotte' && <Flotte />}
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
      
      <div className={cn("transition-all duration-300", sidebarOpen ? "lg:ml-72" : "lg:ml-0")}>
        <Header 
          title={SUBSECTION_LABELS[activeTab] || 'Alpha'} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
      
      <Suspense fallback={null}>
        <TeamChat />
      </Suspense>
    </div>
  );
};

export default Index;

import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TeamChatPage } from '@/components/TeamChat';
import { useAuth } from '@/hooks/useAuth';
import {
  BonCarburant,
  CartesCarburant,
  ChargesVehicule,
  Clients,
  Dashboard,
  DriverControlPlanning,
  FacturesVente,
  FacturesFournisseur,
  AvoirClientPage,
  AvoirFournisseurPage,
  FinanceModule,
  Flotte,
  Fournisseurs,
  GestionDevis,
  HrEmployeesHub,
  Inventory,
  Maintenance,
  MyProfilePage,
  PermissionsManager,
  PlatformConsole,
  TenantBillingPage,
  MarketingLeadsAdmin,
  ReportingModule,
  BarcodeLabelsPage,
  Planning,
  PurchaseRequestManager,
  RDV,
  Reports,
  RhRapports,
  RhStatistiques,
  Settings,
  SuiviPartiesHub,
  SupplierComparison,
  Transactions,
  UnifiedDocumentList,
  VehiculeStats,
  WarehouseDocumentManager,
  WarehouseDeliveryNotesManager,
} from '@/router/lazyPages';
import { BootstrapGate, RouteLoader, SubsectionRoute } from '@/router/RouteGuards';

function DashboardPage() {
  const { session } = useAuth();
  return (
    <ErrorBoundary title="Erreur du tableau de bord">
      <Dashboard key={session?.user?.id ?? 'guest'} />
    </ErrorBoundary>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export function ErpRoutes() {
  return (
    <BootstrapGate>
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <SubsectionRoute subsectionId="dashboard">
              <DashboardPage />
            </SubsectionRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <SubsectionRoute subsectionId="finance-rapports">
              <LazyRoute>
                <ReportingModule />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/products" element={<Navigate to="/inventory/products" replace />} />
        <Route path="/inventory" element={<Navigate to="/inventory/products" replace />} />
        <Route
          path="/inventory/products"
          element={
            <SubsectionRoute subsectionId="inventory">
              <LazyRoute>
                <Inventory />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/purchase-requests"
          element={
            <SubsectionRoute subsectionId="demande-achat-magasin">
              <LazyRoute>
                <PurchaseRequestManager />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/entry-notes"
          element={
            <SubsectionRoute subsectionId="be-magasin">
              <LazyRoute>
                <WarehouseDocumentManager type="BE" title="Bons d'Entrée" />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/exit-notes"
          element={
            <SubsectionRoute subsectionId="bs-magasin">
              <LazyRoute>
                <WarehouseDocumentManager type="BS" title="Bons de Sortie" />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/delivery-notes"
          element={
            <SubsectionRoute subsectionId="bl-magasin">
              <LazyRoute>
                <WarehouseDeliveryNotesManager />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/supplier-delivery-notes"
          element={<Navigate to="/inventory/delivery-notes?tab=fournisseur" replace />}
        />
        <Route
          path="/inventory/price-comparison"
          element={
            <SubsectionRoute subsectionId="comparison">
              <LazyRoute>
                <SupplierComparison />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/stock"
          element={
            <SubsectionRoute subsectionId="transactions">
              <LazyRoute>
                <Transactions />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/barcode-labels"
          element={
            <SubsectionRoute subsectionId="barcode-labels">
              <LazyRoute>
                <BarcodeLabelsPage />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/inventory/reports"
          element={
            <SubsectionRoute subsectionId="reports">
              <LazyRoute>
                <Reports />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/sales" element={<Navigate to="/sales/clients" replace />} />
        <Route
          path="/sales/clients"
          element={
            <SubsectionRoute subsectionId="commerciale-clients">
              <LazyRoute>
                <Clients />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/sales/quotations"
          element={
            <SubsectionRoute subsectionId="devis-vente">
              <LazyRoute>
                <GestionDevis
                  key="devis-vente"
                  initialSection="history"
                  initialDevisType="vente"
                  lockDevisType
                  sectionMode="devis"
                />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/sales/orders"
          element={
            <SubsectionRoute subsectionId="bc-vente">
              <LazyRoute>
                <GestionDevis key="bc-vente" initialSection="bc" initialDevisType="vente" sectionMode="bc" />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/sales/delivery-notes"
          element={
            <SubsectionRoute subsectionId="bl-vente">
              <LazyRoute>
                <GestionDevis
                  key="bl-vente"
                  initialSection="bl"
                  initialDevisType="vente"
                  lockDevisType
                  sectionMode="bl"
                />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/sales/invoices"
          element={
            <SubsectionRoute subsectionId="factures-vente">
              <LazyRoute>
                <FacturesVente />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/sales/avoir-client"
          element={
            <SubsectionRoute subsectionId="avoir-client">
              <LazyRoute>
                <AvoirClientPage />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/purchases" element={<Navigate to="/purchases/requests" replace />} />
        <Route
          path="/purchases/requests"
          element={
            <SubsectionRoute subsectionId="demande-achat">
              <LazyRoute>
                <PurchaseRequestManager />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/purchases/suppliers"
          element={
            <SubsectionRoute subsectionId="commerciale-fournisseurs">
              <LazyRoute>
                <Fournisseurs />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/purchases/quotations"
          element={
            <SubsectionRoute subsectionId="devis-achat">
              <LazyRoute>
                <GestionDevis
                  key="devis-achat"
                  initialSection="history"
                  initialDevisType="achat"
                  lockDevisType
                  sectionMode="devis"
                />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/purchases/orders"
          element={
            <SubsectionRoute subsectionId="bc-achat">
              <LazyRoute>
                <GestionDevis
                  key="bc-achat"
                  initialSection="bc"
                  initialDevisType="achat"
                  lockDevisType
                  sectionMode="bc"
                />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/purchases/invoices"
          element={
            <SubsectionRoute subsectionId="factures-achat">
              <LazyRoute>
                <FacturesFournisseur />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/purchases/avoir-fournisseur"
          element={
            <SubsectionRoute subsectionId="avoir-fournisseur">
              <LazyRoute>
                <AvoirFournisseurPage />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/commercial" element={<Navigate to="/commercial/parties" replace />} />
        <Route
          path="/commercial/parties"
          element={
            <SubsectionRoute subsectionId="suivi-parties">
              <LazyRoute>
                <SuiviPartiesHub />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route path="/commercial/gallery" element={<Navigate to="/commercial/parties" replace />} />
        <Route
          path="/commercial/appointments"
          element={
            <SubsectionRoute subsectionId="rdv">
              <LazyRoute>
                <RDV />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/hr" element={<Navigate to="/hr/employees" replace />} />
        <Route
          path="/hr/employees"
          element={
            <SubsectionRoute subsectionId="rh-employes">
              <LazyRoute>
                <HrEmployeesHub />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/hr/planning"
          element={
            <SubsectionRoute subsectionId="planning">
              <LazyRoute>
                <Planning />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/hr/control-planning"
          element={
            <SubsectionRoute subsectionId="rh-planning-controle">
              <LazyRoute>
                <DriverControlPlanning />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/hr/reports"
          element={
            <SubsectionRoute subsectionId="rh-rapports">
              <LazyRoute>
                <RhRapports />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/hr/statistics"
          element={
            <SubsectionRoute subsectionId="rh-statistiques">
              <LazyRoute>
                <RhStatistiques />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/finance"
          element={
            <SubsectionRoute subsectionId="finance-hub">
              <LazyRoute>
                <FinanceModule />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route path="/vehicles" element={<Navigate to="/vehicles/fleet" replace />} />
        <Route
          path="/vehicles/fleet"
          element={
            <SubsectionRoute subsectionId="flotte">
              <LazyRoute>
                <Flotte initialSection="flotte" />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/status"
          element={
            <SubsectionRoute subsectionId="vehicules-status">
              <LazyRoute>
                <Flotte initialSection="status" />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/statistics"
          element={
            <SubsectionRoute subsectionId="vehicules-stats">
              <LazyRoute>
                <VehiculeStats />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/fuel-vouchers"
          element={
            <SubsectionRoute subsectionId="vehicules-bons">
              <LazyRoute>
                <BonCarburant />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/fuel-cards"
          element={
            <SubsectionRoute subsectionId="vehicules-cartes">
              <LazyRoute>
                <CartesCarburant />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/maintenance"
          element={
            <SubsectionRoute subsectionId="vehicules-maintenance">
              <LazyRoute>
                <Maintenance />
              </LazyRoute>
            </SubsectionRoute>
          }
        />
        <Route
          path="/vehicles/charges"
          element={
            <SubsectionRoute subsectionId="vehicules-charges">
              <LazyRoute>
                <ChargesVehicule />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/admin/leads"
          element={
            <SubsectionRoute subsectionId="accounts" requireAdmin>
              <LazyRoute>
                <MarketingLeadsAdmin />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/platform"
          element={
            <SubsectionRoute subsectionId="platform-console" requirePlatformAdmin>
              <LazyRoute>
                <PlatformConsole />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/users"
          element={
            <SubsectionRoute subsectionId="accounts" requireAdmin>
              <LazyRoute>
                <PermissionsManager />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <SubsectionRoute subsectionId="tenant-billing">
              <LazyRoute>
                <TenantBillingPage />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <SubsectionRoute subsectionId="profile">
              <LazyRoute>
                <MyProfilePage />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <SubsectionRoute subsectionId="settings" requireAdmin>
              <LazyRoute>
                <Settings />
              </LazyRoute>
            </SubsectionRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <SubsectionRoute subsectionId="team-chat">
              <TeamChatPage />
            </SubsectionRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </BootstrapGate>
  );
}

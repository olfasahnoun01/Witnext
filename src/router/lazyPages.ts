import { lazy } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

export { Dashboard } from '@/components/Dashboard';

export const Inventory = lazy(() =>
  import('@/components/Inventory').then((m) => ({ default: m.Inventory }))
);
export const Transactions = lazy(() =>
  import('@/components/Transactions').then((m) => ({ default: m.Transactions }))
);
export const Reports = lazy(() =>
  import('@/components/Reports').then((m) => ({ default: m.Reports }))
);
export const Settings = lazy(() =>
  import('@/components/Settings').then((m) => ({ default: m.Settings }))
);
export const SupplierComparison = lazy(() =>
  import('@/components/SupplierComparison').then((m) => ({ default: m.SupplierComparison }))
);
export const Fournisseurs = lazy(() =>
  import('@/components/Fournisseurs').then((m) => ({ default: m.Fournisseurs }))
);
export const Clients = lazy(() =>
  import('@/components/Clients').then((m) => ({ default: m.Clients }))
);
export const GestionDevis = lazy(() =>
  import('@/components/GestionDevis').then((m) => ({ default: m.GestionDevis }))
);
export const PhotoGallery = lazy(() =>
  import('@/components/PhotoGallery').then((m) => ({ default: m.PhotoGallery }))
);
export const UnifiedDocumentList = lazy(() =>
  import('@/components/devis/UnifiedDocumentList').then((m) => ({ default: m.UnifiedDocumentList }))
);
export const PurchaseRequestManager = lazyWithRetry(() =>
  import('@/components/devis/PurchaseRequestManager').then((m) => ({
    default: m.PurchaseRequestManager,
  }))
);
export const WarehouseDocumentManager = lazy(() =>
  import('@/components/inventory/WarehouseDocumentManager').then((m) => ({
    default: m.WarehouseDocumentManager,
  }))
);
export const Planning = lazy(() =>
  import('@/components/Planning').then((m) => ({ default: m.Planning }))
);
export const DriverControlPlanning = lazy(() =>
  import('@/components/rh/DriverControlPlanning').then((m) => ({
    default: m.DriverControlPlanning,
  }))
);
export const RhRapports = lazy(() =>
  import('@/components/rh/RhRapports').then((m) => ({ default: m.RhRapports }))
);
export const RhStatistiques = lazy(() =>
  import('@/components/rh/RhStatistiques').then((m) => ({ default: m.RhStatistiques }))
);
export const HrEmployeesHub = lazy(() =>
  import('@/components/rh/HrEmployeesHub').then((m) => ({ default: m.HrEmployeesHub }))
);
export const Flotte = lazy(() =>
  import('@/components/Flotte').then((m) => ({ default: m.Flotte }))
);
export const VehiculeStats = lazy(() =>
  import('@/components/vehicules/VehiculeStats').then((m) => ({ default: m.VehiculeStats }))
);
export const BonCarburant = lazy(() =>
  import('@/components/vehicules/BonCarburant').then((m) => ({ default: m.BonCarburant }))
);
export const CartesCarburant = lazy(() =>
  import('@/components/vehicules/CartesCarburant').then((m) => ({ default: m.CartesCarburant }))
);
export const Maintenance = lazy(() =>
  import('@/components/vehicules/Maintenance').then((m) => ({ default: m.Maintenance }))
);
export const ChargesVehicule = lazy(() =>
  import('@/components/vehicules/ChargesVehicule').then((m) => ({ default: m.ChargesVehicule }))
);
export const FluxSuiviHub = lazy(() =>
  import('@/modules/flux/components/FluxSuiviHub').then((m) => ({ default: m.FluxSuiviHub }))
);
export const PermissionsManager = lazy(() =>
  import('@/components/PermissionsManager').then((m) => ({ default: m.PermissionsManager }))
);
export const RDV = lazy(() =>
  import('@/components/commercial/RDV').then((m) => ({ default: m.RDV }))
);
export const SuiviPartiesHub = lazy(() =>
  import('@/components/commercial/SuiviPartiesHub').then((m) => ({ default: m.SuiviPartiesHub }))
);
export const FacturesVente = lazy(() =>
  import('@/components/commercial/FacturesVente').then((m) => ({ default: m.FacturesVente }))
);
export const FinanceModule = lazy(() =>
  import('@/modules/finance/FinanceModule').then((m) => ({ default: m.FinanceModule }))
);

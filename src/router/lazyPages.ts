import { lazyWithRetry } from '@/lib/lazyWithRetry';

export { Dashboard } from '@/components/Dashboard';

export const Inventory = lazyWithRetry(() =>
  import('@/components/Inventory').then((m) => ({ default: m.Inventory }))
);
export const Transactions = lazyWithRetry(() =>
  import('@/components/Transactions').then((m) => ({ default: m.Transactions }))
);
export const Reports = lazyWithRetry(() =>
  import('@/components/Reports').then((m) => ({ default: m.Reports }))
);
export const Settings = lazyWithRetry(() =>
  import('@/components/Settings').then((m) => ({ default: m.Settings }))
);
export const SupplierComparison = lazyWithRetry(() =>
  import('@/components/SupplierComparison').then((m) => ({ default: m.SupplierComparison }))
);
export const Fournisseurs = lazyWithRetry(() =>
  import('@/components/Fournisseurs').then((m) => ({ default: m.Fournisseurs }))
);
export const Clients = lazyWithRetry(() =>
  import('@/components/Clients').then((m) => ({ default: m.Clients }))
);
export const GestionDevis = lazyWithRetry(() =>
  import('@/components/GestionDevis').then((m) => ({ default: m.GestionDevis }))
);
export const PhotoGallery = lazyWithRetry(() =>
  import('@/components/PhotoGallery').then((m) => ({ default: m.PhotoGallery }))
);
export const UnifiedDocumentList = lazyWithRetry(() =>
  import('@/components/devis/UnifiedDocumentList').then((m) => ({ default: m.UnifiedDocumentList }))
);
export const PurchaseRequestManager = lazyWithRetry(() =>
  import('@/components/devis/PurchaseRequestManager').then((m) => ({
    default: m.PurchaseRequestManager,
  }))
);
export const WarehouseDocumentManager = lazyWithRetry(() =>
  import('@/components/inventory/WarehouseDocumentManager').then((m) => ({
    default: m.WarehouseDocumentManager,
  }))
);
export const Planning = lazyWithRetry(() =>
  import('@/components/Planning').then((m) => ({ default: m.Planning }))
);
export const DriverControlPlanning = lazyWithRetry(() =>
  import('@/components/rh/DriverControlPlanning').then((m) => ({
    default: m.DriverControlPlanning,
  }))
);
export const RhRapports = lazyWithRetry(() =>
  import('@/components/rh/RhRapports').then((m) => ({ default: m.RhRapports }))
);
export const RhStatistiques = lazyWithRetry(() =>
  import('@/components/rh/RhStatistiques').then((m) => ({ default: m.RhStatistiques }))
);
export const HrEmployeesHub = lazyWithRetry(() =>
  import('@/components/rh/HrEmployeesHub').then((m) => ({ default: m.HrEmployeesHub }))
);
export const Flotte = lazyWithRetry(() =>
  import('@/components/Flotte').then((m) => ({ default: m.Flotte }))
);
export const VehiculeStats = lazyWithRetry(() =>
  import('@/components/vehicules/VehiculeStats').then((m) => ({ default: m.VehiculeStats }))
);
export const BonCarburant = lazyWithRetry(() =>
  import('@/components/vehicules/BonCarburant').then((m) => ({ default: m.BonCarburant }))
);
export const CartesCarburant = lazyWithRetry(() =>
  import('@/components/vehicules/CartesCarburant').then((m) => ({ default: m.CartesCarburant }))
);
export const Maintenance = lazyWithRetry(() =>
  import('@/components/vehicules/Maintenance').then((m) => ({ default: m.Maintenance }))
);
export const ChargesVehicule = lazyWithRetry(() =>
  import('@/components/vehicules/ChargesVehicule').then((m) => ({ default: m.ChargesVehicule }))
);
export const FluxSuiviHub = lazyWithRetry(() =>
  import('@/modules/flux/components/FluxSuiviHub').then((m) => ({ default: m.FluxSuiviHub }))
);
export const PermissionsManager = lazyWithRetry(() =>
  import('@/components/PermissionsManager').then((m) => ({ default: m.PermissionsManager }))
);
export const RDV = lazyWithRetry(() =>
  import('@/components/commercial/RDV').then((m) => ({ default: m.RDV }))
);
export const SuiviPartiesHub = lazyWithRetry(() =>
  import('@/components/commercial/SuiviPartiesHub').then((m) => ({ default: m.SuiviPartiesHub }))
);
export const FacturesVente = lazyWithRetry(() =>
  import('@/components/commercial/FacturesVente').then((m) => ({ default: m.FacturesVente }))
);
export const AvoirClientPage = lazyWithRetry(() =>
  import('@/components/commercial/CommercialAvoirPage').then((m) => ({ default: m.AvoirClientPage }))
);
export const AvoirFournisseurPage = lazyWithRetry(() =>
  import('@/components/commercial/CommercialAvoirPage').then((m) => ({
    default: m.AvoirFournisseurPage,
  }))
);
export const FinanceModule = lazyWithRetry(() =>
  import('@/modules/finance/FinanceModule').then((m) => ({ default: m.FinanceModule }))
);

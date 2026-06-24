import { SUBSECTION_LABELS, SUBSECTION_TO_SECTION } from '@/config/navigation';

/**
 * Canonical URL for each ERP subsection (single source of truth).
 * Legacy subsection ids (e.g. notifications) map through getPathForSubsection.
 */
export const SUBSECTION_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',

  // Magasin & stock → /inventory/*
  inventory: '/inventory/products',
  'demande-achat-magasin': '/inventory/purchase-requests',
  'be-magasin': '/inventory/entry-notes',
  'bs-magasin': '/inventory/exit-notes',
  'bl-magasin': '/inventory/delivery-notes',
  comparison: '/inventory/price-comparison',
  transactions: '/inventory/stock',
  reports: '/inventory/reports',

  // Ventes → /sales/*
  'commerciale-clients': '/sales/clients',
  'devis-vente': '/sales/quotations',
  'bc-vente': '/sales/orders',
  'bl-vente': '/sales/delivery-notes',
  'factures-vente': '/sales/invoices',

  // Achats → /purchases/*
  'demande-achat': '/purchases/requests',
  'commerciale-fournisseurs': '/purchases/suppliers',
  'devis-achat': '/purchases/quotations',
  'bc-achat': '/purchases/orders',
  'bc-fournisseur-reception': '/purchases/reception',

  // Commercial
  'flux-suivi': '/commercial/flux',
  'flux-suivi-magasin': '/commercial/flux',
  'suivi-parties': '/commercial/parties',
  'suivi-clients': '/commercial/parties',
  'suivi-fournisseurs': '/commercial/parties',
  gallery: '/commercial/gallery',
  rdv: '/commercial/appointments',

  // RH → /hr/*
  'rh-employes': '/hr/employees',
  planning: '/hr/planning',
  'rh-planning-controle': '/hr/control-planning',
  'rh-rapports': '/hr/reports',
  'rh-statistiques': '/hr/statistics',

  finance: '/finance',
  'finance-hub': '/finance',

  // Véhicules → /vehicles/*
  flotte: '/vehicles/fleet',
  'vehicules-status': '/vehicles/status',
  'vehicules-stats': '/vehicles/statistics',
  'vehicules-bons': '/vehicles/fuel-vouchers',
  'vehicules-cartes': '/vehicles/fuel-cards',
  'vehicules-maintenance': '/vehicles/maintenance',
  'vehicules-charges': '/vehicles/charges',

  accounts: '/users',
  settings: '/settings',
  'team-chat': '/messages',
};

const PATH_TO_SUBSECTION: Record<string, string> = Object.entries(SUBSECTION_ROUTES).reduce(
  (acc, [id, path]) => {
    if (!acc[path]) acc[path] = id;
    return acc;
  },
  {} as Record<string, string>
);

export function normalizePathname(pathname: string): string {
  const base = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return base || '/';
}

export function getPathForSubsection(subsectionId: string): string {
  return SUBSECTION_ROUTES[subsectionId] ?? '/dashboard';
}

export function getSubsectionFromPath(pathname: string): string | null {
  return PATH_TO_SUBSECTION[normalizePathname(pathname)] ?? null;
}

export function getPageTitle(pathname: string): string {
  const subsectionId = getSubsectionFromPath(pathname);
  if (subsectionId === 'team-chat') return 'Chat Équipe';
  if (subsectionId && SUBSECTION_LABELS[subsectionId]) {
    return SUBSECTION_LABELS[subsectionId];
  }
  return 'Witnext';
}

export function getSectionIdForPath(pathname: string): string | null {
  const subsectionId = getSubsectionFromPath(pathname);
  if (!subsectionId) return null;
  return SUBSECTION_TO_SECTION[subsectionId] ?? null;
}

/** Module index redirects (parent paths → default child). */
export const MODULE_INDEX_REDIRECTS: Record<string, string> = {
  '/inventory': '/inventory/products',
  '/sales': '/sales/clients',
  '/purchases': '/purchases/requests',
  '/hr': '/hr/employees',
  '/commercial': '/commercial/flux',
  '/vehicles': '/vehicles/fleet',
};

export const ROUTE_PREFETCH_BY_SUBSECTION: Record<string, () => void> = {
  dashboard: () => {
    import('@/components/Inventory');
  },
  inventory: () => {
    import('@/components/Transactions');
    import('@/components/Fournisseurs');
  },
  'commerciale-fournisseurs': () => {
    import('@/components/SupplierComparison');
  },
  transactions: () => {
    import('@/components/Reports');
  },
  'demande-achat': () => {
    import('@/components/devis/PurchaseRequestManager');
  },
  'demande-achat-magasin': () => {
    import('@/components/devis/PurchaseRequestManager');
  },
};

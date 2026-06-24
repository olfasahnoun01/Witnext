import {
  ShoppingCart,
  Package,
  Users as UsersIcon,
  Wallet,
  Car,
  Briefcase,
  GitBranch,
  LayoutDashboard,
  Building2,
  Users,
  GitCompare,
  ArrowLeftRight,
  FileText,
  ClipboardList,
  FileSignature,
  ImageIcon,
  CalendarClock,
  CalendarDays,
  FileBarChart,
  ClipboardPen,
  Truck,
  Wrench,
  BarChart3,
  Fuel,
  CreditCard,
  Receipt,
  Settings,
  ShoppingBag,
  PackageCheck,
  TrendingUp,
  TableProperties,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

/** Sub-sections visible only when the active company code matches. */
export const COMPANY_SCOPED_SUBSECTIONS: Record<string, string> = {
  planning: 'granisafe',
  'rh-rapports': 'granisafe',
  'rh-statistiques': 'granisafe',
  'rh-planning-controle': 'granisafe',
};

export const COMPANY_DISPLAY_NAMES: Record<string, string> = {
  grosafe: 'Grosafe',
  granisafe: 'Granisafe',
  safe_team: 'Safe-Team',
};

/** True when the subsection is allowed for the active company (or not company-scoped). */
export function isSubsectionVisibleForCompany(
  subsectionId: string,
  companyCode: string | null | undefined
): boolean {
  const required = COMPANY_SCOPED_SUBSECTIONS[subsectionId];
  if (!required) return true;
  return companyCode === required;
}

export interface SubSection {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
}

export interface BigSection {
  id: string;
  label: string;
  icon: LucideIcon;
  subsections: SubSection[];
  /** Hidden from the sidebar — e.g. administration lives in the user profile menu. */
  sidebarHidden?: boolean;
}

export const BIG_SECTIONS: BigSection[] = [
  {
    id: 'commercial',
    label: 'Commercial',
    icon: Briefcase,
    subsections: [
      { id: 'flux-suivi', label: 'Suivi des flux', icon: GitBranch },
      { id: 'suivi-parties', label: 'Suivi client / fournisseur', icon: UserCheck },
      { id: 'gallery', label: 'Galerie commerciale', icon: ImageIcon },
      { id: 'rdv', label: 'Rendez-vous', icon: CalendarClock },
    ],
  },
  {
    id: 'ventes',
    label: 'Ventes',
    icon: ShoppingCart,
    subsections: [
      { id: 'commerciale-clients', label: 'Clients', icon: Users },
      { id: 'devis-vente', label: 'Devis', icon: ClipboardList },
      { id: 'bc-vente', label: 'Bons de Commande', icon: FileText },
      { id: 'bl-vente', label: 'Bons de Livraison', icon: Truck },
      { id: 'factures-vente', label: 'Factures', icon: Receipt },
    ],
  },
  {
    id: 'achats',
    label: 'Achats',
    icon: ShoppingBag,
    subsections: [
      { id: 'demande-achat', label: "Demandes d'achat", icon: FileSignature },
      { id: 'commerciale-fournisseurs', label: 'Fournisseurs', icon: Building2 },
      { id: 'devis-achat', label: "Devis fournisseurs", icon: ClipboardList },
      { id: 'bc-achat', label: "BC fournisseurs", icon: FileText },
      { id: 'bc-fournisseur-reception', label: 'Réception fournisseurs', icon: PackageCheck },
    ],
  },
  {
    id: 'magasin',
    label: 'Magasin & Stock',
    icon: Package,
    subsections: [
      { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
      { id: 'demande-achat-magasin', label: "Demandes d'achat", icon: FileSignature },
      { id: 'inventory', label: 'Inventaire', icon: Package },
      { id: 'be-magasin', label: "Bons d'Entrée", icon: PackageCheck },
      { id: 'bs-magasin', label: 'Bons de Sortie', icon: TrendingUp },
      { id: 'bl-magasin', label: 'Bons de Livraison', icon: Truck },

      { id: 'comparison', label: 'Comparaison Prix', icon: GitCompare },
      { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'reports', label: 'Rapports & Documents', icon: FileText },
    ],
  },
  {
    id: 'rh',
    label: 'Ressources Humaines',
    icon: UsersIcon,
    subsections: [
      { id: 'rh-employes', label: 'Employées', icon: Users },
      { id: 'planning', label: 'Planning', icon: CalendarDays },
      { id: 'rh-planning-controle', label: 'Planning de contrôle', icon: TableProperties },
      { id: 'rh-rapports', label: 'Rapports', icon: ClipboardPen },
      { id: 'rh-statistiques', label: 'Statistiques', icon: FileBarChart },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    subsections: [
      { id: 'finance-hub', label: 'Espace Finance', icon: Wallet },
    ],
  },
  {
    id: 'vehicules',
    label: 'Véhicules',
    icon: Car,
    subsections: [
      { id: 'flotte', label: 'Flotte', icon: Truck },
      { id: 'vehicules-status', label: 'Status', icon: Car },
      { id: 'vehicules-stats', label: 'Statistiques', icon: BarChart3 },
      { id: 'vehicules-bons', label: 'Bons Carburants', icon: Fuel },
      { id: 'vehicules-cartes', label: 'Cartes Carburants', icon: CreditCard },
      { id: 'vehicules-maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: Settings,
    sidebarHidden: true,
    subsections: [
      { id: 'accounts', label: 'Gestion des Comptes', icon: UsersIcon },
      { id: 'settings', label: 'Paramètres', icon: Settings },
    ],
  },
];

// Map sub-section id back to parent big section id
export const SUBSECTION_TO_SECTION: Record<string, string> = BIG_SECTIONS.reduce(
  (acc, sec) => {
    sec.subsections.forEach((sub) => {
      acc[sub.id] = sec.id;
    });
    return acc;
  },
  {} as Record<string, string>
);

export const SUBSECTION_LABELS: Record<string, string> = BIG_SECTIONS.reduce(
  (acc, sec) => {
    sec.subsections.forEach((sub) => {
      acc[sub.id] = sub.label;
    });
    return acc;
  },
  {} as Record<string, string>
);

import {
  ShoppingCart,
  Package,
  Users as UsersIcon,
  Wallet,
  Car,
  Briefcase,
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
  FileMinus,
  Settings,
  ShoppingBag,
  PackageCheck,
  TrendingUp,
  TableProperties,
  UserCheck,
  ScanBarcode,
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
  /** Optional group label rendered inside a section (e.g. Magasin sub-groups). */
  group?: string;
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
    id: 'direction',
    label: 'Direction',
    icon: LayoutDashboard,
    subsections: [
      { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
      { id: 'finance-rapports', label: 'Rapports & Analyses', icon: FileBarChart },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    icon: Briefcase,
    subsections: [
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
      { id: 'avoir-client', label: 'Avoir Client', icon: FileMinus },
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
      { id: 'factures-achat', label: 'Factures Fournisseur', icon: Receipt },
      { id: 'avoir-fournisseur', label: 'Avoir Fournisseur', icon: FileMinus },
    ],
  },
  {
    id: 'magasin',
    label: 'Magasin & Stock',
    icon: Package,
    subsections: [
      { id: 'demande-achat-magasin', label: 'Demandes magasin', icon: FileSignature, group: 'Achats magasin' },
      { id: 'inventory', label: 'Inventaire', icon: Package, group: 'Stock' },
      { id: 'be-magasin', label: "Bons d'Entrée", icon: PackageCheck, group: 'Stock' },
      { id: 'bs-magasin', label: 'Bons de Sortie', icon: TrendingUp, group: 'Stock' },
      { id: 'bl-magasin', label: 'Bons de Livraison', icon: Truck, group: 'Stock' },
      { id: 'comparison', label: 'Comparaison Prix', icon: GitCompare, group: 'Analyse' },
      { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight, group: 'Analyse' },
      { id: 'barcode-labels', label: 'Étiquettes code-barres', icon: ScanBarcode, group: 'Analyse' },
      { id: 'reports', label: 'Rapports & Documents', icon: FileText, group: 'Analyse' },
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

import {
  ShoppingCart,
  Package,
  Users as UsersIcon,
  Wallet,
  Car,
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
  UserCheck,
  UserCog,
  CalendarDays,
  UserPlus,
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
  type LucideIcon,
} from 'lucide-react';

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
}

export const BIG_SECTIONS: BigSection[] = [
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
      { id: 'suivi-clients', label: 'Suivi Clients', icon: UserCheck },
      { id: 'gallery', label: 'Galerie commerciale', icon: ImageIcon },
      { id: 'rdv', label: 'Rendez-vous', icon: CalendarClock },
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
      { id: 'suivi-fournisseurs', label: 'Suivi Fournisseurs', icon: UserCog },
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
      { id: 'planning', label: 'Planning', icon: CalendarDays },
      { id: 'employees', label: 'Liste Employés', icon: UserPlus },
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

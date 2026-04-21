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
  type LucideIcon,
} from 'lucide-react';

export interface SubSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface BigSection {
  id: string;
  label: string;
  icon: LucideIcon;
  subsections: SubSection[];
}

export const BIG_SECTIONS: BigSection[] = [
  {
    id: 'commerciale',
    label: 'Commerciale',
    icon: ShoppingCart,
    subsections: [
      { id: 'rdv', label: 'Liste des Rendez-vous', icon: CalendarClock },
      { id: 'suivi-clients', label: 'Suivi Clients', icon: UserCheck },
      { id: 'suivi-fournisseurs', label: 'Suivi Fournisseurs', icon: UserCog },
    ],
  },
  {
    id: 'magasin',
    label: 'Magasin & Stock',
    icon: Package,
    subsections: [
      { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
      { id: 'inventory', label: 'Inventaire', icon: Package },
      { id: 'fournisseurs', label: 'Fournisseurs', icon: Building2 },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'comparison', label: 'Comparaison Prix', icon: GitCompare },
      { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'reports', label: 'Rapports & Documents', icon: FileText },
      { id: 'devis', label: 'Gestion Devis', icon: ClipboardList },
      { id: 'ba', label: "Bons d'achat", icon: FileSignature },
      { id: 'gallery', label: 'Galerie Photos', icon: ImageIcon },
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
    subsections: [],
  },
  {
    id: 'vehicules',
    label: 'Véhicules',
    icon: Car,
    subsections: [
      { id: 'flotte', label: 'Flotte', icon: Truck },
      { id: 'gestion-vehicules', label: 'Gestion Véhicules', icon: Wrench },
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

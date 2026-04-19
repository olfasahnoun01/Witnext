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
    subsections: [],
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
    subsections: [],
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
    subsections: [],
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

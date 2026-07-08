export type PricingPlanCode = 'essentiel' | 'pro' | 'entreprise';

export interface PricingPlan {
  code: PricingPlanCode;
  name: string;
  tagline: string;
  priceLabel: string;
  priceNote?: string;
  highlighted?: boolean;
  features: string[];
  modules: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    code: 'essentiel',
    name: 'Essentiel',
    tagline: 'Pour démarrer la gestion commerciale et stock',
    priceLabel: 'Sur devis',
    features: [
      'Jusqu\'à 5 utilisateurs',
      'Magasin & inventaire',
      'Ventes : devis, BC, BL',
      'Achats fournisseurs',
      'Support email',
    ],
    modules: ['magasin', 'ventes', 'achats'],
  },
  {
    code: 'pro',
    name: 'Pro',
    tagline: 'Suite complète pour PME en croissance',
    priceLabel: 'Sur devis',
    priceNote: 'Le plus demandé',
    highlighted: true,
    features: [
      'Jusqu\'à 25 utilisateurs',
      'Tous les modules Essentiel',
      'Commercial & CRM',
      'Finance & fiscalité TN',
      'Flotte & carburant',
      'Application desktop',
      'Support prioritaire',
    ],
    modules: ['magasin', 'ventes', 'achats', 'commercial', 'finance', 'vehicules'],
  },
  {
    code: 'entreprise',
    name: 'Entreprise',
    tagline: 'Multi-sociétés, RH et personnalisation',
    priceLabel: 'Sur devis',
    features: [
      'Utilisateurs illimités',
      'Multi-sociétés (Grosafe, Granisafe, etc.)',
      'Ressources humaines & planning',
      'Rapports chauffeurs (mobile)',
      'Formation & accompagnement',
      'Déploiement sur mesure',
    ],
    modules: ['magasin', 'ventes', 'achats', 'commercial', 'finance', 'vehicules', 'rh'],
  },
];

export const MARKETING_MODULES = [
  {
    id: 'commercial',
    title: 'Commercial',
    description: 'Suivi clients/fournisseurs, galerie produits et rendez-vous.',
  },
  {
    id: 'ventes',
    title: 'Ventes',
    description: 'Devis, bons de commande, livraisons et facturation client.',
  },
  {
    id: 'achats',
    title: 'Achats',
    description: 'Demandes d\'achat, devis fournisseurs et bons de commande achat.',
  },
  {
    id: 'magasin',
    title: 'Magasin & Stock',
    description: 'Inventaire, entrées/sorties, rapports et traçabilité.',
  },
  {
    id: 'rh',
    title: 'Ressources Humaines',
    description: 'Employés, planning, rapports terrain et statistiques.',
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Trésorerie, fiscalité tunisienne, paiements et déclarations.',
  },
  {
    id: 'vehicules',
    title: 'Véhicules',
    description: 'Flotte, bons carburant, maintenance et statistiques.',
  },
] as const;

export const MODULE_OPTIONS = MARKETING_MODULES.map((m) => ({
  id: m.id,
  label: m.title,
}));

export function getPlanByCode(code: string | null | undefined): PricingPlan | undefined {
  if (!code) return undefined;
  return PRICING_PLANS.find((p) => p.code === code);
}

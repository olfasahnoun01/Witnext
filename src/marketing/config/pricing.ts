export type PricingPlanCode = 'essentiel' | 'pro' | 'entreprise';
export type BillingCycle = 'monthly' | 'annual';

export interface PricingPlan {
  code: PricingPlanCode;
  name: string;
  tagline: string;
  /** Affichage court (ex. "149 DT" ou "Sur devis"). */
  priceLabel: string;
  /** Prix mensuel HT en DT ; null = sur devis. */
  monthlyPriceHt: number | null;
  /** Prix annuel HT en DT (souvent 10 mois) ; null = sur devis. */
  annualPriceHt: number | null;
  priceNote?: string;
  highlighted?: boolean;
  features: string[];
  modules: string[];
  ctaTrial: string;
  ctaBuy: string;
}

export const PRICING_VAT_NOTE = 'Prix HT · TVA 19 % en sus';

export const PRICING_PLANS: PricingPlan[] = [
  {
    code: 'essentiel',
    name: 'Essentiel',
    tagline: 'Stock, ventes et achats pour démarrer sans friction',
    priceLabel: '149 DT',
    monthlyPriceHt: 149,
    annualPriceHt: 1490,
    features: [
      "Jusqu'à 5 utilisateurs",
      'Magasin & inventaire temps réel',
      'Ventes : devis, BC, BL',
      'Achats fournisseurs',
      'Support email',
    ],
    modules: ['magasin', 'ventes', 'achats'],
    ctaTrial: 'Essayer Essentiel',
    ctaBuy: 'Demander une licence',
  },
  {
    code: 'pro',
    name: 'Pro',
    tagline: 'La suite PME : commercial, finance TN et flotte',
    priceLabel: '399 DT',
    monthlyPriceHt: 399,
    annualPriceHt: 3990,
    priceNote: 'Le plus demandé',
    highlighted: true,
    features: [
      "Jusqu'à 25 utilisateurs",
      'Tous les modules Essentiel',
      'Commercial & CRM',
      'Finance & fiscalité tunisienne',
      'Flotte & carburant',
      'Application desktop Windows',
      'Support prioritaire',
    ],
    modules: ['magasin', 'ventes', 'achats', 'commercial', 'finance', 'vehicules'],
    ctaTrial: 'Essayer Pro gratuitement',
    ctaBuy: 'Passer sur Pro',
  },
  {
    code: 'entreprise',
    name: 'Entreprise',
    tagline: 'Multi-sociétés, RH et déploiement accompagné',
    priceLabel: 'Sur devis',
    monthlyPriceHt: null,
    annualPriceHt: null,
    features: [
      'Utilisateurs illimités',
      'Multi-sociétés (Grosafe, Granisafe, etc.)',
      'Ressources humaines & planning',
      'Rapports chauffeurs (mobile)',
      'Formation & accompagnement',
      'Déploiement sur mesure',
    ],
    modules: ['magasin', 'ventes', 'achats', 'commercial', 'finance', 'vehicules', 'rh'],
    ctaTrial: 'Demander une démo',
    ctaBuy: 'Parler à un expert',
  },
];

/** Prix affiché selon le cycle (mensuel équivalent pour l'annuel). */
export function formatPlanPrice(
  plan: PricingPlan,
  cycle: BillingCycle
): { primary: string; secondary?: string } {
  if (plan.monthlyPriceHt == null) {
    return {
      primary: 'Sur devis',
      secondary: 'À partir de 899 DT / mois',
    };
  }
  if (cycle === 'monthly') {
    return {
      primary: `${plan.monthlyPriceHt} DT`,
      secondary: '/ mois HT',
    };
  }
  const annual = plan.annualPriceHt ?? plan.monthlyPriceHt * 10;
  const perMonth = Math.round(annual / 12);
  return {
    primary: `${annual} DT`,
    secondary: `/ an HT · soit ~${perMonth} DT/mois`,
  };
}

export function annualSavingsLabel(plan: PricingPlan): string | null {
  if (plan.monthlyPriceHt == null || plan.annualPriceHt == null) return null;
  const full = plan.monthlyPriceHt * 12;
  const saved = full - plan.annualPriceHt;
  if (saved <= 0) return null;
  return `Économisez ${saved} DT / an`;
}

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
    description: "Demandes d'achat, devis fournisseurs et bons de commande achat.",
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
    description: 'Trésorerie, fiscalité tunisienne, retenues TEJ et déclarations.',
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

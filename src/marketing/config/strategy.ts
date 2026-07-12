/**
 * Messaging & funnel content for the Witnext marketing site.
 * Positioning: ERP cloud + desktop for Tunisian SMEs (fiscalité, stock, ops).
 */

export const MARKETING_POSITIONING = {
  audience: 'PME et groupes multi-sociétés en Tunisie',
  promise:
    'Un seul ERP pour stock, commercial, finance locale et opérations terrain — sans Excel fragmenté.',
  differentiators: [
    'Fiscalité et retenues adaptées à la Tunisie (TVA, TEJ)',
    'Multi-sociétés avec isolation des données',
    'Web + application Windows pour le magasin et la flotte',
  ],
} as const;

export const HOME_HERO = {
  headlineBeforeBrand: 'Pilotez votre entreprise avec',
  support:
    'Stock, commercial, finance tunisienne et flotte dans une seule plateforme — pour décider plus vite et déclarer sans stress.',
  primaryCta: 'Essai gratuit 14 jours',
  secondaryCta: 'Voir les tarifs',
} as const;

export const HOME_STEPS = [
  {
    step: '01',
    title: 'Choisissez votre offre',
    text: 'Essentiel, Pro ou Entreprise selon votre taille et vos modules.',
  },
  {
    step: '02',
    title: 'Activez votre essai',
    text: 'Notre équipe configure votre espace et vous contacte sous 48 h.',
  },
  {
    step: '03',
    title: 'Pilotez au quotidien',
    text: 'Équipes magasin, commercial et finance travaillent sur les mêmes données.',
  },
] as const;

export const TUNISIA_PAINS = [
  {
    title: 'Excel partout',
    text: 'Devis, stock et caisse dispersés : erreurs, retards et double saisie.',
  },
  {
    title: 'Fiscalité locale',
    text: 'TVA, retenues à la source et déclarations demandent un outil pensé pour la Tunisie.',
  },
  {
    title: 'Multi-sites / multi-sociétés',
    text: 'Grosafe, Granisafe, Safe-Team… besoin d’une vue consolidée sans mélanger les données.',
  },
] as const;

export const TUNISIA_WINS = [
  {
    title: 'Flux commercial unifié',
    text: 'Devis → commande → livraison → facture, relié au stock et à la trésorerie.',
  },
  {
    title: 'Finance & TEJ',
    text: 'Paiements, retenues et export XML pour la plateforme TEJ.',
  },
  {
    title: 'Terrain & flotte',
    text: 'Carburant, maintenance et rapports chauffeurs depuis le même ERP.',
  },
] as const;

export const PRICING_FAQ = [
  {
    q: 'Puis-je essayer avant d’acheter ?',
    a: 'Oui. L’essai gratuit est guidé : nous créons votre espace, vous testez avec vos processus, puis vous choisissez une licence.',
  },
  {
    q: 'Les prix incluent-ils la TVA ?',
    a: 'Les montants affichés sont hors taxes. La TVA tunisienne (19 %) s’applique selon votre facturation.',
  },
  {
    q: 'Que gagne-t-on avec l’abonnement annuel ?',
    a: 'Environ deux mois offerts par rapport au mensuel (ex. Pro : 3 990 DT/an au lieu de 4 788 DT).',
  },
  {
    q: 'Witnext remplace-t-il Excel et plusieurs logiciels ?',
    a: 'Pour la plupart des PME, oui : stock, ventes, achats, commercial, finance et flotte dans une seule base sécurisée.',
  },
  {
    q: 'Et pour plusieurs sociétés ?',
    a: 'L’offre Entreprise (ou options Pro) couvre le multi-sociétés avec isolation des données et permissions par rôle.',
  },
] as const;

export const TRUST_BULLETS = [
  'Réponse sous 48 h ouvrés',
  'Données isolées par société (RLS)',
  'Web + desktop Windows',
  'Accompagnement local en français / arabe',
] as const;

export const FINAL_CTA = {
  title: 'Passez d’Excel à un ERP tunisien, en une semaine',
  text: 'Demandez un essai Pro — l’offre la plus complète pour les PME en croissance — ou parlez-nous de votre déploiement Entreprise.',
  primary: 'Démarrer l’essai gratuit',
  secondary: 'Demander un devis',
} as const;

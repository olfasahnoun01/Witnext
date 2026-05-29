/**
 * Extrait du plan comptable des entreprises tunisiennes (PCG).
 * Référentiel local — compléter via l'écran Plan comptable.
 */

export interface ChartAccount {
  code: string;
  libelle: string;
  classe: number;
  type: 'actif' | 'passif' | 'charge' | 'produit' | 'tresorerie';
}

export const PLAN_COMPTABLE_TUNISIE: ChartAccount[] = [
  { code: '101000', libelle: 'Capital social', classe: 1, type: 'passif' },
  { code: '401000', libelle: 'Fournisseurs', classe: 4, type: 'passif' },
  { code: '411000', libelle: 'Clients', classe: 4, type: 'actif' },
  { code: '431000', libelle: 'Timbre fiscal / taxes sur le chiffre', classe: 4, type: 'passif' },
  { code: '445620', libelle: 'TVA déductible sur achats', classe: 4, type: 'actif' },
  { code: '445710', libelle: 'TVA collectée 19 %', classe: 4, type: 'passif' },
  { code: '445799', libelle: 'TVA collectée autres taux', classe: 4, type: 'passif' },
  { code: '512100', libelle: 'Banques', classe: 5, type: 'tresorerie' },
  { code: '514000', libelle: 'Effets à recevoir', classe: 5, type: 'actif' },
  { code: '531000', libelle: 'Caisse', classe: 5, type: 'tresorerie' },
  { code: '607000', libelle: 'Achats de marchandises', classe: 6, type: 'charge' },
  { code: '700000', libelle: 'Ventes de marchandises', classe: 7, type: 'produit' },
];

export function getAccountLabel(code: string): string {
  return PLAN_COMPTABLE_TUNISIE.find((a) => a.code === code)?.libelle ?? `Compte ${code}`;
}

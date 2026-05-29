/**
 * Moteur TVA tunisienne — taux légaux et calculs HT / TVA / TTC à 3 décimales.
 */

import { round3 } from './money';
import type { TauxTvaTunisie } from '../types/financeDomain';

export const TAUX_TVA_TUNISIE: Array<{ value: TauxTvaTunisie; label: string; description: string }> = [
  { value: 19, label: '19 %', description: 'Taux standard — commerce, services généraux' },
  { value: 13, label: '13 %', description: 'Intermédiaire — informatique, télécoms, électricité' },
  { value: 7, label: '7 %', description: 'Réduit — première nécessité, médical, transport personnes' },
  { value: 0, label: '0 %', description: 'Exonéré — exportations, agricole de base' },
];

/**
 * Montant TVA = HT × (taux / 100), arrondi millimes.
 */
export function calculerMontantTva(montantHt: number, taux: TauxTvaTunisie): number {
  return round3(montantHt * (taux / 100));
}

/**
 * TTC = HT + TVA (formule tunisienne standard sur base HT).
 */
export function calculerTtcDepuisHt(montantHt: number, taux: TauxTvaTunisie): number {
  const tva = calculerMontantTva(montantHt, taux);
  return round3(montantHt + tva);
}

/** Décompose un TTC en HT + TVA (utile pour contrôle). */
export function decomposerTtc(montantTtc: number, taux: TauxTvaTunisie): { ht: number; tva: number; ttc: number } {
  if (taux === 0) {
    return { ht: round3(montantTtc), tva: 0, ttc: round3(montantTtc) };
  }
  const ht = round3(montantTtc / (1 + taux / 100));
  const tva = round3(montantTtc - ht);
  return { ht, tva, ttc: round3(montantTtc) };
}

/** Agrège des lignes par taux pour la déclaration mensuelle. */
export function agregerTvaParTaux(
  lignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }>
): Array<{ taux: TauxTvaTunisie; totalHt: number; totalTva: number }> {
  const map = new Map<TauxTvaTunisie, { ht: number; tva: number }>();
  for (const l of lignes) {
    const cur = map.get(l.taux) ?? { ht: 0, tva: 0 };
    cur.ht += l.ht;
    cur.tva += l.tva;
    map.set(l.taux, cur);
  }
  return [...map.entries()]
    .map(([taux, t]) => ({
      taux,
      totalHt: round3(t.ht),
      totalTva: round3(t.tva),
    }))
    .sort((a, b) => b.taux - a.taux);
}

/**
 * Solde déclaration : TVA collectée − TVA déductible.
 * Résultat négatif = crédit de TVA.
 */
export function calculerSoldeDeclarationTva(totalCollectee: number, totalDeductible: number): {
  solde: number;
  estCredit: boolean;
} {
  const solde = round3(totalCollectee - totalDeductible);
  return { solde, estCredit: solde < 0 };
}

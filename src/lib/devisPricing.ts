import { DevisItem } from '@/types';

/**
 * Centralized devis line pricing calculation.
 * 
 * KEY SEMANTIC DIFFERENCE:
 * - HT mode (isTTC=false): item.prix_ttc = Prix U HT (base price before tax)
 * - TTC mode (isTTC=true):  item.prix_ttc = Prix U TTC (price INCLUDING tax)
 */

export interface DevisLinePricing {
  unitHT: number;
  unitTTC: number;
  unitAfterRemiseHT: number;
  unitAfterRemiseTTC: number;
  lineHT: number;
  lineTVA: number;
  lineTTC: number;
  remiseDT_HT: number;  // remise amount in HT
  remiseDT_TTC: number; // remise amount in TTC
}

export function computeDevisLine(
  item: DevisItem,
  isSortantTTC: boolean
): DevisLinePricing {
  const tvaRate = (item.tva ?? 19) / 100;
  const remiseFactor = item.remise > 0 ? (1 - item.remise / 100) : 1;

  let unitHT: number, unitTTC: number;

  if (isSortantTTC) {
    // Sortant + TTC: user entered TTC price
    unitTTC = item.prix_ttc;
    unitHT = unitTTC / (1 + tvaRate);
  } else {
    // Entrant or HT mode: user entered HT price
    unitHT = item.prix_ttc;
    unitTTC = unitHT * (1 + tvaRate);
  }

  const unitAfterRemiseHT = unitHT * remiseFactor;
  const unitAfterRemiseTTC = unitTTC * remiseFactor;

  const lineHT = unitAfterRemiseHT * item.quantity;
  const lineTTC = unitAfterRemiseTTC * item.quantity;
  const lineTVA = lineTTC - lineHT;

  const remiseDT_HT = unitHT * (1 - remiseFactor) * item.quantity;
  const remiseDT_TTC = unitTTC * (1 - remiseFactor) * item.quantity;

  return {
    unitHT,
    unitTTC,
    unitAfterRemiseHT,
    unitAfterRemiseTTC,
    lineHT,
    lineTVA,
    lineTTC,
    remiseDT_HT,
    remiseDT_TTC,
  };
}

export interface DevisTotals {
  totalHT: number;     // sum of gross HT (before remise)
  totalRemise: number; // sum of remise in HT
  totalNet: number;    // net HT (after remise)
  totalTVA: number;
  totalTTC: number;
  totalFinal: number;    // TTC + timbre
  totalFinalHT: number;  // net HT + timbre
}

export function computeDevisTotals(
  items: DevisItem[],
  isSortantTTC: boolean
): DevisTotals {
  let totalHT = 0, totalRemise = 0, totalNet = 0, totalTVA = 0, totalTTC = 0;

  items.forEach(item => {
    const line = computeDevisLine(item, isSortantTTC);
    // Gross HT = unitHT * qty (before remise)
    totalHT += line.unitHT * item.quantity;
    totalRemise += line.remiseDT_HT;
    totalNet += line.lineHT;
    totalTVA += line.lineTVA;
    totalTTC += line.lineTTC;
  });

  return {
    totalHT,
    totalRemise,
    totalNet,
    totalTVA,
    totalTTC,
    totalFinal: totalTTC + 1,    // timbre fiscal
    totalFinalHT: totalNet + 1,  // timbre fiscal
  };
}

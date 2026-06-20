import { DevisItem } from '@/types';

/** Timbre fiscal forfaitaire (DT) appliqué sur facture/devis. */
export const TIMBRE_FISCAL_DT = 1.0;

/** TVA selectable per line — 0 % means no VAT on that line until the user picks a rate. */
export const DEVIS_TVA_OPTIONS = [0, 7, 13, 19] as const;

/** Explicit line TVA only — never default to 19 %. */
export function resolveDevisLineTvaRate(tva?: number | null): number {
  if (tva == null || !Number.isFinite(Number(tva))) return 0;
  return Number(tva);
}

/** Arrondi au millime (3 décimales) — norme fiscale tunisienne. */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Centralized devis line pricing calculation.
 *
 * - `item.prix_ttc` = PU vente saisi : en HT (`isSortantTTC=false`), remise appliquée sur ce HT, puis TVA sur le HT net → PU TTC unitaire ; total ligne TTC = PU TTC net × qté.
 * - `item.prix_achat` = informatif / marge uniquement ; n'entre pas dans remise, TVA ni sous-totaux.
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

/**
 * Total HT column in the articles table: PU (achat or vente) × qté after remise — never includes TVA.
 * - achat / fournisseur: `prix_ttc` is always PU achat HT (TTC toggle ignored).
 * - vente / client: `prix_ttc` is PU vente; when TTC input mode is on, HT is derived before remise.
 */
export function computeArticleTableLineTotalHT(
  item: DevisItem,
  devisType: 'achat' | 'vente',
  isSortantTTC: boolean
): number {
  const remiseFactor = item.remise > 0 ? 1 - item.remise / 100 : 1;
  const tvaRate = resolveDevisLineTvaRate(item.tva) / 100;
  let unitHt = item.prix_ttc;
  if (devisType === 'vente' && isSortantTTC && tvaRate > 0) {
    unitHt = item.prix_ttc / (1 + tvaRate);
  }
  return round3(unitHt * remiseFactor * item.quantity);
}

export function computeDevisLine(
  item: DevisItem,
  isSortantTTC: boolean,
  options?: { isBcFurnitureAchat?: boolean }
): DevisLinePricing & { lineFodec?: number } {
  const tvaRate = resolveDevisLineTvaRate(item.tva) / 100;
  const remiseFactor = item.remise > 0 ? (1 - item.remise / 100) : 1;
  const applyFodec = options?.isBcFurnitureAchat ?? false;
  const fodecRate = applyFodec ? 0.01 : 0;

  let unitHT: number;
  let unitTTC: number;
  let unitAfterRemiseHT: number;
  let unitAfterRemiseTTC: number;

  if (isSortantTTC) {
    // Saisie en PU TTC : on en déduit le HT, puis remise proportionnelle, lignes en qté
    unitTTC = item.prix_ttc;
    unitHT = unitTTC / ((1 + fodecRate) * (1 + tvaRate));
    unitAfterRemiseHT = unitHT * remiseFactor;
    unitAfterRemiseTTC = unitTTC * remiseFactor;
  } else {
    // Saisie en PU vente HT (cas principal) :
    const puVenteHtBrut = item.prix_ttc;
    const puVenteHtNet = puVenteHtBrut * remiseFactor;
    const puVenteTtcNet = puVenteHtNet * (1 + fodecRate) * (1 + tvaRate);

    unitHT = puVenteHtBrut;
    unitTTC = puVenteHtBrut * (1 + fodecRate) * (1 + tvaRate);
    unitAfterRemiseHT = puVenteHtNet;
    unitAfterRemiseTTC = puVenteTtcNet;
  }

  // Round at the line level (millimes). VAT is computed from the rounded net HT + Fodec
  const lineHT = round3(unitAfterRemiseHT * item.quantity);
  const lineFodec = applyFodec ? round3(lineHT * fodecRate) : 0;
  const lineTVA = round3((lineHT + lineFodec) * tvaRate);
  const lineTTC = round3(lineHT + lineFodec + lineTVA);

  const remiseDT_HT = round3(unitHT * (1 - remiseFactor) * item.quantity);
  const remiseDT_TTC = round3(unitTTC * (1 - remiseFactor) * item.quantity);

  return {
    unitHT: round3(unitHT),
    unitTTC: round3(unitTTC),
    unitAfterRemiseHT: round3(unitAfterRemiseHT),
    unitAfterRemiseTTC: round3(unitAfterRemiseTTC),
    lineHT,
    lineTVA,
    lineTTC,
    remiseDT_HT,
    remiseDT_TTC,
    ...(applyFodec ? { lineFodec } : {}),
  };
}

export interface DevisTotals {
  totalHT: number;     // sum of gross HT (before remise)
  totalRemise: number; // sum of remise in HT
  totalNet: number;    // net HT (after remise)
  totalTVA: number;
  totalTTC: number;
  totalFinal: number;    // TTC + timbre (and fodec if applicable)
  totalFinalHT: number;  // net HT + timbre
  totalFodec?: number;   // contribution FODEC if applicable
}

export function computeDevisTotals(
  items: DevisItem[],
  isSortantTTC: boolean,
  options?: {
    devisType?: 'achat' | 'vente';
    docType?: 'devis' | 'bc' | 'ba';
    isTvaEnabled?: boolean;
  }
): DevisTotals {
  let totalHT = 0, totalRemise = 0, totalNet = 0, totalTVA = 0, totalTTC = 0, totalFodec = 0;

  const isBcFurnitureAchat = options?.devisType === 'achat' && options?.docType === 'bc' && options?.isTvaEnabled === true;

  items.forEach(item => {
    const line = computeDevisLine(item, isSortantTTC, { isBcFurnitureAchat });
    // Gross HT = unitHT * qty (before remise)
    totalHT += round3(line.unitHT * item.quantity);
    totalRemise += line.remiseDT_HT;
    totalNet += line.lineHT;
    totalTVA += line.lineTVA;
    totalTTC += line.lineTTC;
    if (line.lineFodec) {
      totalFodec += line.lineFodec;
    }
  });

  const netRounded = round3(totalNet);
  const ttcRounded = round3(totalTTC);
  const fodecRounded = round3(totalFodec);

  return {
    totalHT: round3(totalHT),
    totalRemise: round3(totalRemise),
    totalNet: netRounded,
    totalTVA: round3(totalTVA),
    totalTTC: ttcRounded,
    totalFinal: round3(ttcRounded + TIMBRE_FISCAL_DT),
    totalFinalHT: round3(netRounded + TIMBRE_FISCAL_DT),
    totalFodec: fodecRounded > 0 ? fodecRounded : undefined,
  };
}


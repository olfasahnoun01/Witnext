/**
 * Pure invoice math (HT / remise / FODEC / TVA / TTC / timbre) for the Finance
 * module. Extracted from financeApi.ts so it can be unit-tested without pulling
 * in the Supabase client, and to keep data-access separate from calculations.
 */
import type { InvoiceWriteInput, VatRate } from '../types';
import { COMPTES_PCG, FODEC_TAUX_STANDARD, TIMBRE_FISCAL_FACTURE_DT } from './tunisiaFiscal';
import { calculerMontantTva } from './vatEngine';

type InvoiceLineInput = Pick<
  InvoiceWriteInput['lines'][number],
  'quantity' | 'unit_price_ht' | 'vat_rate' | 'subject_to_fodec' | 'remise_percent'
>;

/** Arrondi au millime (3 décimales) — norme fiscale tunisienne. */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Collected-VAT account for a given rate. Only the standard 19% rate maps to the
 * dedicated account; reduced/intermediate rates (7%, 13%) and any other value go
 * to the "autres taux" account so they are never silently posted as 19%.
 */
export function vatAccountCodeCollectee(rate: VatRate): string {
  if (rate === 19) return COMPTES_PCG.tvaCollectee19;
  return COMPTES_PCG.tvaCollecteeAutre;
}

export function computeInvoiceLine(line: InvoiceLineInput) {
  const brutHt = round3(line.quantity * line.unit_price_ht);
  const remisePct = Math.min(100, Math.max(0, line.remise_percent ?? 0));
  const montantRemise = round3(brutHt * (remisePct / 100));
  const htApresRemise = round3(brutHt - montantRemise);
  const fodec = line.subject_to_fodec ? round3(htApresRemise * (FODEC_TAUX_STANDARD / 100)) : 0;
  const total_ht = round3(htApresRemise + fodec);
  const total_tva = calculerMontantTva(htApresRemise + fodec, line.vat_rate);
  const total_ttc = round3(total_ht + total_tva);
  return { brut_ht: brutHt, montant_remise: montantRemise, remise_percent: remisePct, total_ht, total_tva, total_ttc, fodec };
}

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  options?: { apply_timbre_fiscal?: boolean }
) {
  const totals = lines.reduce(
    (acc, line) => {
      const calc = computeInvoiceLine(line);
      acc.brut_ht += calc.brut_ht;
      acc.montant_remise += calc.montant_remise;
      acc.total_ht += calc.total_ht;
      acc.total_tva += calc.total_tva;
      acc.total_ttc += calc.total_ttc;
      acc.fodec += calc.fodec;
      return acc;
    },
    { brut_ht: 0, montant_remise: 0, total_ht: 0, total_tva: 0, total_ttc: 0, fodec: 0 }
  );
  const timbre = options?.apply_timbre_fiscal ? TIMBRE_FISCAL_FACTURE_DT : 0;
  return {
    brut_ht: round3(totals.brut_ht),
    montant_remise: round3(totals.montant_remise),
    total_ht: round3(totals.total_ht),
    total_tva: round3(totals.total_tva),
    total_ttc: round3(totals.total_ttc + timbre),
    timbre_fiscal: timbre,
    fodec_total: round3(totals.fodec),
  };
}

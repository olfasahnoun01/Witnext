/**
 * Déclarations TVA — persistance table tax_declarations (Supabase existante).
 */

import { supabase } from '@/integrations/supabase/client';
import { round3 } from '../lib/money';
import type { VatMonthlyDeclaration } from '../types/financeDomain';
import { fetchVatMonthlyDeclaration } from './vatDeclarationApi';

function periodBounds(mois: number, annee: number): { start: string; end: string } {
  const start = `${annee}-${String(mois).padStart(2, '0')}-01`;
  const lastDay = new Date(annee, mois, 0).getDate();
  const end = `${annee}-${String(mois).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export interface TaxDeclarationRow {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  vat_collected: number;
  vat_deductible_purchases: number;
  net_vat_due: number;
  withholding_supplier: number | null;
  status: string;
  notes: string | null;
  filed_at: string | null;
  created_at: string;
}

export async function listTaxDeclarations(companyId: string): Promise<TaxDeclarationRow[]> {
  const { data, error } = await supabase
    .from('tax_declarations')
    .select('*')
    .eq('company_id', companyId)
    .order('period_start', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaxDeclarationRow[];
}

/** Enregistre le brouillon de déclaration TVA du mois (upsert par période). */
export async function saveVatDeclarationDraft(
  companyId: string,
  mois: number,
  annee: number,
  withholdingSupplier = 0
): Promise<TaxDeclarationRow> {
  const calc = await fetchVatMonthlyDeclaration(companyId, mois, annee);
  const { start, end } = periodBounds(mois, annee);
  const { data: auth } = await supabase.auth.getUser();

  const payload = {
    company_id: companyId,
    period_start: start,
    period_end: end,
    vat_collected: calc.totalCollectee,
    vat_deductible_purchases: round3(
      calc.deductibleAchats.reduce((s, r) => s + r.totalTva, 0) +
        calc.deductibleImmobilisations.reduce((s, r) => s + r.totalTva, 0)
    ),
    net_vat_due: calc.estCredit ? 0 : calc.solde,
    withholding_supplier: withholdingSupplier || null,
    status: 'draft',
    notes: calc.estCredit
      ? `Crédit de TVA : ${Math.abs(calc.solde).toFixed(3)} DT`
      : `TVA à verser : ${calc.solde.toFixed(3)} DT`,
    created_by: auth.user?.id ?? null,
  };

  const { data: existing } = await supabase
    .from('tax_declarations')
    .select('id')
    .eq('company_id', companyId)
    .eq('period_start', start)
    .eq('period_end', end)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('tax_declarations')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as TaxDeclarationRow;
  }

  const { data, error } = await supabase
    .from('tax_declarations')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TaxDeclarationRow;
}

/** Marque la déclaration comme déposée (date de dépôt). */
export async function fileTaxDeclaration(declarationId: string): Promise<void> {
  const { error } = await supabase
    .from('tax_declarations')
    .update({
      status: 'filed',
      filed_at: new Date().toISOString(),
    })
    .eq('id', declarationId);
  if (error) throw new Error(error.message);
}

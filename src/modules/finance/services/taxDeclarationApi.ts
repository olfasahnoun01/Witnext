/**

 * Déclarations TVA — persistance table tax_declarations (Supabase existante).

 */



import { supabase } from '@/integrations/supabase/client';

import { formatSoldeTvaNote } from '../lib/fiscalTerminology';

import { round3 } from '../lib/money';

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

  tcl_due: number | null;

  status: string;

  notes: string | null;

  filed_at: string | null;

  created_at: string;

}



export interface SaveVatDeclarationOptions {

  withholdingSupplier?: number;

  tclDue?: number | null;

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



/** Déclaration enregistrée pour une période (brouillon ou déposée), ou null. */

export async function getTaxDeclarationForPeriod(

  companyId: string,

  mois: number,

  annee: number

): Promise<TaxDeclarationRow | null> {

  const { start, end } = periodBounds(mois, annee);

  const { data, error } = await supabase

    .from('tax_declarations')

    .select('*')

    .eq('company_id', companyId)

    .eq('period_start', start)

    .eq('period_end', end)

    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data as TaxDeclarationRow | null) ?? null;

}



/** Enregistre le TCL à payer pour la période (upsert si nécessaire). */

export async function saveTclDue(

  companyId: string,

  mois: number,

  annee: number,

  tclDue: number

): Promise<TaxDeclarationRow> {

  const amount = round3(Math.max(0, tclDue));

  const existing = await getTaxDeclarationForPeriod(companyId, mois, annee);

  if (existing) {

    const { data, error } = await supabase

      .from('tax_declarations')

      .update({ tcl_due: amount })

      .eq('id', existing.id)

      .select('*')

      .single();

    if (error) throw new Error(error.message);

    return data as TaxDeclarationRow;

  }

  return saveVatDeclarationDraft(companyId, mois, annee, { tclDue: amount });

}



/** Enregistre le brouillon de déclaration TVA du mois (upsert par période). */

export async function saveVatDeclarationDraft(

  companyId: string,

  mois: number,

  annee: number,

  options: SaveVatDeclarationOptions = {}

): Promise<TaxDeclarationRow> {

  const calc = await fetchVatMonthlyDeclaration(companyId, mois, annee);

  const { start, end } = periodBounds(mois, annee);

  const { data: auth } = await supabase.auth.getUser();



  const existing = await getTaxDeclarationForPeriod(companyId, mois, annee);

  const tclDue =

    options.tclDue !== undefined

      ? options.tclDue === null

        ? null

        : round3(Math.max(0, options.tclDue))

      : (existing?.tcl_due ?? null);



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

    withholding_supplier: options.withholdingSupplier ?? existing?.withholding_supplier ?? null,

    tcl_due: tclDue,

    status: 'draft' as const,

    notes: formatSoldeTvaNote(calc.solde, calc.estCredit),

    created_by: auth.user?.id ?? null,

  };



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



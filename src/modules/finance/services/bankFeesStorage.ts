/**
 * Frais bancaires — persistance Supabase par société (RLS user_companies).
 */

import { supabase } from '@/integrations/supabase/client';
import type { BankFeeCharge, BankFeeTypeDefinition, TauxTvaTunisie } from '../types/financeDomain';
import { FRAIS_BANCAIRES_TYPES } from '../lib/constants';

function fail(err: { message?: string } | null, fallback: string): never {
  throw new Error(err?.message || fallback);
}

export function defaultBankFeeTypes(): BankFeeTypeDefinition[] {
  return FRAIS_BANCAIRES_TYPES.map((t) => ({ id: t.id, label: t.label, builtin: true }));
}

export async function loadBankFeeTypes(companyId: string): Promise<BankFeeTypeDefinition[]> {
  const { data, error } = await supabase
    .from('bank_fee_types')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (error) fail(error, 'Chargement des types de frais impossible');

  const builtins = defaultBankFeeTypes();
  const custom: BankFeeTypeDefinition[] = (data ?? [])
    .filter((c) => !builtins.some((b) => b.id === c.id))
    .map((c) => ({ id: c.id, label: c.label, builtin: false }));
  return [...builtins, ...custom];
}

export async function saveCustomBankFeeType(
  companyId: string,
  label: string
): Promise<BankFeeTypeDefinition> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Libellé obligatoire.');
  const entry: BankFeeTypeDefinition = { id: `custom-${Date.now()}`, label: trimmed, builtin: false };
  const { error } = await supabase
    .from('bank_fee_types')
    .insert({ id: entry.id, company_id: companyId, label: trimmed });
  if (error) fail(error, "Enregistrement du type de frais impossible");
  return entry;
}

function mapFeeRow(r: Record<string, unknown>): BankFeeCharge {
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    treasuryAccountId: r.treasury_account_id as string,
    treasuryAccountName: r.treasury_account_name as string,
    feeTypeId: r.fee_type_id as string,
    feeTypeLabel: r.fee_type_label as string,
    label: r.label as string,
    montantHt: Number(r.montant_ht),
    tauxTva: Number(r.taux_tva) as TauxTvaTunisie,
    montantTva: Number(r.montant_tva),
    montantTtc: Number(r.montant_ttc),
    dateOperation: r.date_operation as string,
    dateEcheance: (r.date_echeance as string | null) ?? null,
    status: r.status as BankFeeCharge['status'],
    notes: (r.notes as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function loadBankFees(companyId: string): Promise<BankFeeCharge[]> {
  const { data, error } = await supabase
    .from('bank_fees')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Chargement des frais bancaires impossible');
  return (data ?? []).map(mapFeeRow);
}

export async function addBankFee(
  companyId: string,
  fee: Omit<BankFeeCharge, 'id' | 'createdAt'>
): Promise<BankFeeCharge> {
  const row: BankFeeCharge = {
    ...fee,
    companyId,
    id: `bf-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('bank_fees').insert({
    id: row.id,
    company_id: companyId,
    treasury_account_id: row.treasuryAccountId,
    treasury_account_name: row.treasuryAccountName,
    fee_type_id: row.feeTypeId,
    fee_type_label: row.feeTypeLabel,
    label: row.label,
    montant_ht: row.montantHt,
    taux_tva: row.tauxTva,
    montant_tva: row.montantTva,
    montant_ttc: row.montantTtc,
    date_operation: row.dateOperation,
    date_echeance: row.dateEcheance ?? null,
    status: row.status,
    notes: row.notes ?? null,
    created_at: row.createdAt,
  });
  if (error) fail(error, 'Enregistrement du frais bancaire impossible');
  return row;
}

export async function updateBankFeeStatus(
  companyId: string,
  feeId: string,
  status: BankFeeCharge['status']
): Promise<void> {
  const { error } = await supabase
    .from('bank_fees')
    .update({ status })
    .eq('company_id', companyId)
    .eq('id', feeId);
  if (error) fail(error, 'Mise à jour du frais bancaire impossible');
}

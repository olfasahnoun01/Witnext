/**
 * Crédit-bail véhicules — persistance Supabase (leasing_credit_contracts).
 */

import { supabase } from '@/integrations/supabase/client';
import { round3 } from '../lib/money';
import {
  emptyLeasingMonthAmounts,
  emptyLeasingYearSchedule,
  type LeasingCreditContract,
  type LeasingLineKind,
  type LeasingMonthAmounts,
  type LeasingMonthlySchedule,
} from '../types/leasingCredit';

function fail(error: { message?: string }, msg: string): never {
  throw new Error(error.message ? `${msg} : ${error.message}` : msg);
}

function normalizeSchedule(raw: unknown): LeasingMonthlySchedule {
  const base = emptyLeasingYearSchedule();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (let m = 1; m <= 12; m++) {
    const key = String(m);
    const month = obj[key];
    if (!month || typeof month !== 'object') continue;
    const row = month as Record<string, unknown>;
    base[key] = {
      marge: round3(Number(row.marge) || 0),
      capital: round3(Number(row.capital) || 0),
      tva: round3(Number(row.tva) || 0),
      timbre: round3(Number(row.timbre) || 0),
      ttc: round3(Number(row.ttc) || 0),
      assurance: round3(Number(row.assurance) || 0),
    };
  }
  return base;
}

function mapRow(r: Record<string, unknown>): LeasingCreditContract {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    bankName: String(r.bank_name),
    contractNumber: String(r.contract_number),
    contractDate: String(r.contract_date).slice(0, 10),
    year: Number(r.year),
    monthlySchedule: normalizeSchedule(r.monthly_schedule),
    createdAt: String(r.created_at),
  };
}

export async function loadLeasingContracts(
  companyId: string,
  year: number
): Promise<LeasingCreditContract[]> {
  const { data, error } = await supabase
    .from('leasing_credit_contracts')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .order('bank_name')
    .order('contract_number');
  if (error) fail(error, 'Chargement des contrats crédit-bail impossible');
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function upsertLeasingContract(
  contract: Omit<LeasingCreditContract, 'createdAt'>
): Promise<LeasingCreditContract> {
  const { data, error } = await supabase
    .from('leasing_credit_contracts')
    .upsert(
      {
        id: contract.id,
        company_id: contract.companyId,
        bank_name: contract.bankName.trim(),
        contract_number: contract.contractNumber.trim(),
        contract_date: contract.contractDate,
        year: contract.year,
        monthly_schedule: contract.monthlySchedule,
      },
      { onConflict: 'company_id,contract_number,year' }
    )
    .select('*')
    .single();
  if (error) fail(error, 'Enregistrement du contrat crédit-bail impossible');
  return mapRow(data as Record<string, unknown>);
}

export async function deleteLeasingContract(id: string): Promise<void> {
  const { error } = await supabase.from('leasing_credit_contracts').delete().eq('id', id);
  if (error) fail(error, 'Suppression du contrat impossible');
}

export function updateScheduleCell(
  schedule: LeasingMonthlySchedule,
  month: number,
  line: LeasingLineKind,
  value: number
): LeasingMonthlySchedule {
  const key = String(month);
  const current = schedule[key] ?? emptyLeasingMonthAmounts();
  return {
    ...schedule,
    [key]: { ...current, [line]: round3(value) },
  };
}

export function newLeasingContractId(): string {
  return `lc-${crypto.randomUUID()}`;
}

import { supabase } from '@/integrations/supabase/client';
import { computePayrollSlip } from '../lib/tunisiaPayroll';
import type { PayrollPeriod, PayrollSlipRow } from '../lib/payrollTypes';

const SLIP_SELECT = `
  *,
  employee:hr_employees(prenom, nom, cin)
`;

function slipToPayload(slip: ReturnType<typeof computePayrollSlip> & {
  period_id: string;
  employee_id: string;
  matricule_cnss: string;
}) {
  return {
    period_id: slip.period_id,
    employee_id: slip.employee_id,
    matricule_cnss: slip.matricule_cnss,
    taux_horaire: slip.taux_horaire,
    jours_ht: slip.jours_ht,
    nb_heures: slip.nb_heures,
    nb_heures_supp: slip.nb_heures_supp,
    jours_conge: slip.jours_conge,
    jours_ferie: slip.jours_ferie,
    salaire_base: slip.salaire_base,
    primes: slip.primes,
    salaire_brut: slip.salaire_brut,
    cnss_salariale: slip.cnss_salariale,
    salaire_declare_cnss: slip.salaire_declare_cnss,
    salaire_imposable: slip.salaire_imposable,
    irpp: slip.irpp,
    css: slip.css,
    salaire_net: slip.salaire_net,
    avances: slip.avances,
    prets: slip.prets,
    penalites: slip.penalites,
    net_a_payer: slip.net_a_payer,
  };
}

export async function getOrCreatePayrollPeriod(
  companyId: string,
  year: number,
  month: number
): Promise<PayrollPeriod | null> {
  const { data: existing } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (existing) return existing as PayrollPeriod;

  const { data, error } = await supabase
    .from('payroll_periods')
    .insert({ company_id: companyId, year, month })
    .select('*')
    .single();

  if (error) {
    console.error('[payroll] period:', error);
    return null;
  }
  return data as PayrollPeriod;
}

export async function listPayrollSlips(periodId: string): Promise<PayrollSlipRow[]> {
  const { data, error } = await supabase
    .from('payroll_slips')
    .select(SLIP_SELECT)
    .eq('period_id', periodId)
    .order('matricule_cnss');

  if (error) {
    console.error('[payroll] slips:', error);
    return [];
  }
  return (data || []) as PayrollSlipRow[];
}

export async function listPayrollSlipsForMonths(
  companyId: string,
  year: number,
  months: number[]
): Promise<PayrollSlipRow[]> {
  const { data: periods } = await supabase
    .from('payroll_periods')
    .select('id')
    .eq('company_id', companyId)
    .eq('year', year)
    .in('month', months);

  const periodIds = (periods || []).map((p) => p.id);
  if (periodIds.length === 0) return [];

  const { data, error } = await supabase
    .from('payroll_slips')
    .select(SLIP_SELECT)
    .in('period_id', periodIds);

  if (error) {
    console.error('[payroll] slips quarter:', error);
    return [];
  }
  return (data || []) as PayrollSlipRow[];
}

async function sumRhMovements(
  employeeId: string,
  year: number,
  month: number,
  types: Array<'avance' | 'penalite' | 'pret'>
): Promise<number> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data } = await supabase
    .from('hr_payroll_movements')
    .select('amount, movement_type')
    .eq('employee_id', employeeId)
    .in('movement_type', types)
    .gte('movement_date', start)
    .lt('movement_date', end);

  return (data || []).reduce((s, row) => s + Number(row.amount), 0);
}

async function countLeaveDays(employeeId: string, year: number, month: number): Promise<number> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const { data } = await supabase
    .from('hr_employee_leaves')
    .select('date_from, date_to')
    .eq('employee_id', employeeId);

  let days = 0;
  for (const leave of data || []) {
    const from = new Date(`${leave.date_from}T12:00:00`);
    const to = new Date(`${leave.date_to}T12:00:00`);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d >= start && d <= end) days += 1;
    }
  }
  return days;
}

export async function importRhDataForSlip(
  employeeId: string,
  year: number,
  month: number
): Promise<{ avances: number; prets: number; penalites: number; jours_conge: number }> {
  const [avances, prets, penalites, jours_conge] = await Promise.all([
    sumRhMovements(employeeId, year, month, ['avance']),
    sumRhMovements(employeeId, year, month, ['pret']),
    sumRhMovements(employeeId, year, month, ['penalite']),
    countLeaveDays(employeeId, year, month),
  ]);
  return { avances, prets, penalites, jours_conge };
}

export async function generatePayrollSlips(
  companyId: string,
  year: number,
  month: number
): Promise<{ ok: boolean; count: number; error?: string }> {
  const period = await getOrCreatePayrollPeriod(companyId, year, month);
  if (!period) return { ok: false, count: 0, error: 'Période introuvable' };

  const { data: employees, error: empErr } = await supabase
    .from('hr_employees')
    .select('id, matricule_cnss, taux_horaire, nom, prenom')
    .eq('company_id', companyId)
    .order('nom');

  if (empErr) return { ok: false, count: 0, error: empErr.message };
  if (!employees?.length) return { ok: false, count: 0, error: 'Aucun employé pour cette société' };

  const rows = [];
  for (const emp of employees) {
    const rh = await importRhDataForSlip(emp.id, year, month);
    const computed = computePayrollSlip({
      taux_horaire: Number(emp.taux_horaire) || 0,
      jours_ht: 0,
      nb_heures: 173.33,
      nb_heures_supp: 0,
      jours_conge: rh.jours_conge,
      jours_ferie: 0,
      primes: 0,
      avances: rh.avances,
      prets: rh.prets,
      penalites: rh.penalites,
    });
    rows.push(
      slipToPayload({
        ...computed,
        period_id: period.id,
        employee_id: emp.id,
        matricule_cnss: emp.matricule_cnss,
      })
    );
  }

  const { error } = await supabase.from('payroll_slips').upsert(rows as never, {
    onConflict: 'period_id,employee_id',
  });

  if (error) return { ok: false, count: 0, error: error.message };
  return { ok: true, count: rows.length };
}

export async function updatePayrollSlip(
  slip: PayrollSlipRow,
  patch: Partial<PayrollSlipRow>
): Promise<{ ok: boolean; row?: PayrollSlipRow; error?: string }> {
  const merged = { ...slip, ...patch };
  const computed = computePayrollSlip({
    taux_horaire: merged.taux_horaire,
    jours_ht: merged.jours_ht,
    nb_heures: merged.nb_heures,
    nb_heures_supp: merged.nb_heures_supp,
    jours_conge: merged.jours_conge,
    jours_ferie: merged.jours_ferie,
    primes: merged.primes,
    avances: merged.avances,
    prets: merged.prets,
    penalites: merged.penalites,
  });

  const payload = slipToPayload({
    ...computed,
    period_id: slip.period_id,
    employee_id: slip.employee_id,
    matricule_cnss: merged.matricule_cnss,
  });

  const { data, error } = await supabase
    .from('payroll_slips')
    .update(payload)
    .eq('id', slip.id)
    .select(SLIP_SELECT)
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as PayrollSlipRow };
}

export async function recomputeAllSlips(periodId: string): Promise<void> {
  const slips = await listPayrollSlips(periodId);
  for (const slip of slips) {
    await updatePayrollSlip(slip, slip);
  }
}

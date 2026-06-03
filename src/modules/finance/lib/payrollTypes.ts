export interface PayrollPeriod {
  id: string;
  company_id: string;
  year: number;
  month: number;
  status: 'draft' | 'validated';
  created_at: string;
  updated_at: string;
}

export interface PayrollSlipRow {
  id: string;
  period_id: string;
  employee_id: string;
  matricule_cnss: string;
  taux_horaire: number;
  jours_ht: number;
  nb_heures: number;
  nb_heures_supp: number;
  jours_conge: number;
  jours_ferie: number;
  salaire_base: number;
  primes: number;
  salaire_brut: number;
  cnss_salariale: number;
  salaire_declare_cnss: number;
  salaire_imposable: number;
  irpp: number;
  css: number;
  salaire_net: number;
  avances: number;
  prets: number;
  penalites: number;
  net_a_payer: number;
  employee?: {
    prenom: string;
    nom: string;
    cin: string | null;
  } | null;
}

export const PAYROLL_MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

export function formatPayrollMoney(value: number): string {
  return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

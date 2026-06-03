export interface HrEmployee {
  id: string;
  company_id: string | null;
  prenom: string;
  nom: string;
  cin: string | null;
  matricule_cnss: string;
  taux_horaire: number;
  phone1: string | null;
  phone2: string | null;
  adresse: string | null;
  contract_url: string | null;
  salaire_net: number;
  created_at: string;
  updated_at: string;
}

export interface HrEmployeeLeave {
  id: string;
  employee_id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  created_at: string;
  employee?: Pick<HrEmployee, 'prenom' | 'nom'> | null;
}

export type HrPayrollMovementType = 'avance' | 'penalite' | 'pret';

export interface HrPayrollMovement {
  id: string;
  employee_id: string;
  movement_type: HrPayrollMovementType;
  amount: number;
  movement_date: string;
  note: string | null;
  created_at: string;
  employee?: Pick<HrEmployee, 'prenom' | 'nom'> | null;
}

export function formatHrMoney(value: number): string {
  return `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;
}

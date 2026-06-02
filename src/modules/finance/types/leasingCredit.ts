export type LeasingLineKind = 'marge' | 'capital' | 'tva' | 'timbre' | 'ttc' | 'assurance';

export interface LeasingMonthAmounts {
  marge: number;
  capital: number;
  tva: number;
  timbre: number;
  ttc: number;
  assurance: number;
}

/** Clés mois "1" … "12". */
export type LeasingMonthlySchedule = Record<string, LeasingMonthAmounts>;

export interface LeasingCreditContract {
  id: string;
  companyId: string;
  bankName: string;
  contractNumber: string;
  contractDate: string;
  year: number;
  monthlySchedule: LeasingMonthlySchedule;
  createdAt: string;
}

export const LEASING_LINE_KINDS: LeasingLineKind[] = [
  'marge',
  'capital',
  'tva',
  'timbre',
  'ttc',
  'assurance',
];

export const LEASING_LINE_LABELS: Record<LeasingLineKind, string> = {
  marge: 'Marge',
  capital: 'Capital',
  tva: 'TVA',
  timbre: 'Timbre',
  ttc: 'TTC',
  assurance: 'Assurance',
};

export const LEASING_MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

export function emptyLeasingMonthAmounts(): LeasingMonthAmounts {
  return { marge: 0, capital: 0, tva: 0, timbre: 0, ttc: 0, assurance: 0 };
}

export function emptyLeasingYearSchedule(): LeasingMonthlySchedule {
  const schedule: LeasingMonthlySchedule = {};
  for (let m = 1; m <= 12; m++) {
    schedule[String(m)] = emptyLeasingMonthAmounts();
  }
  return schedule;
}

/**
 * Calculs paie / CNSS — république tunisienne (taux paramétrables).
 * À ajuster selon barèmes et plafonds en vigueur.
 */

export const TUNISIA_PAYROLL_RATES = {
  /** Plafond mensuel assiette CNSS (DT) */
  cnssPlafondMensuel: 5000,
  /** Cotisation salariale CNSS */
  cnssSalariale: 0.0918,
  /** Déclaration employeur — sécurité sociale */
  cnssPatronaleSecuriteSociale: 0.2675,
  /** Déclaration employeur — accident du travail */
  cnssPatronaleAccidentTravail: 0.004,
  /** Taxe formation professionnelle */
  tfp: 0.02,
  /** Fonds promotion logement salariés */
  foprolos: 0.01,
  /** Contribution sociale de solidarité (simplifié) */
  css: 0.005,
  /** Majoration heures supplémentaires */
  heuresSuppCoefficient: 1.5,
} as const;

export type PayrollSlipInputs = {
  taux_horaire: number;
  jours_ht: number;
  nb_heures: number;
  nb_heures_supp: number;
  jours_conge: number;
  jours_ferie: number;
  primes: number;
  avances: number;
  prets: number;
  penalites: number;
};

export type PayrollSlipComputed = PayrollSlipInputs & {
  salaire_base: number;
  salaire_brut: number;
  cnss_salariale: number;
  salaire_declare_cnss: number;
  salaire_imposable: number;
  irpp: number;
  css: number;
  salaire_net: number;
  net_a_payer: number;
};

export function roundPayroll(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Barème IRPP annuel simplifié (tranches en DT / an). */
export function computeIrppAnnual(annualImposable: number): number {
  if (annualImposable <= 0) return 0;
  const brackets: Array<{ upTo: number; rate: number }> = [
    { upTo: 5000, rate: 0 },
    { upTo: 20000, rate: 0.26 },
    { upTo: 30000, rate: 0.28 },
    { upTo: 50000, rate: 0.32 },
    { upTo: Infinity, rate: 0.35 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (annualImposable <= prev) break;
    const slice = Math.min(annualImposable, b.upTo) - prev;
    if (slice > 0) tax += slice * b.rate;
    prev = b.upTo;
  }
  return roundPayroll(tax);
}

export function computeIrppMonthly(salaireImposable: number): number {
  return roundPayroll(computeIrppAnnual(salaireImposable * 12) / 12);
}

export function computePayrollSlip(inputs: PayrollSlipInputs): PayrollSlipComputed {
  const r = TUNISIA_PAYROLL_RATES;
  const taux = Math.max(0, Number(inputs.taux_horaire) || 0);
  const nbHeures = Math.max(0, Number(inputs.nb_heures) || 0);
  const nbHeuresSupp = Math.max(0, Number(inputs.nb_heures_supp) || 0);
  const primes = Math.max(0, Number(inputs.primes) || 0);

  const salaire_base = roundPayroll(taux * nbHeures);
  const heuresSuppMontant = roundPayroll(taux * nbHeuresSupp * r.heuresSuppCoefficient);
  const salaire_brut = roundPayroll(salaire_base + heuresSuppMontant + primes);

  const salaire_declare_cnss = roundPayroll(Math.min(salaire_brut, r.cnssPlafondMensuel));
  const cnss_salariale = roundPayroll(salaire_declare_cnss * r.cnssSalariale);
  const salaire_imposable = roundPayroll(Math.max(0, salaire_brut - cnss_salariale));
  const irpp = computeIrppMonthly(salaire_imposable);
  const css = roundPayroll(salaire_imposable * r.css);
  const salaire_net = roundPayroll(Math.max(0, salaire_imposable - irpp - css));

  const avances = Math.max(0, Number(inputs.avances) || 0);
  const prets = Math.max(0, Number(inputs.prets) || 0);
  const penalites = Math.max(0, Number(inputs.penalites) || 0);
  const net_a_payer = roundPayroll(Math.max(0, salaire_net - avances - prets - penalites));

  return {
    ...inputs,
    salaire_base,
    salaire_brut,
    cnss_salariale,
    salaire_declare_cnss,
    salaire_imposable,
    irpp,
    css,
    salaire_net,
    net_a_payer,
  };
}

export type CnssDeclarationLine = {
  nature: string;
  salaireDeclare: number;
  tauxCotisation: number;
  montantAPayer: number;
};

export function buildCnssDeclarationLines(totalSalaireDeclare: number): CnssDeclarationLine[] {
  const r = TUNISIA_PAYROLL_RATES;
  const base = roundPayroll(totalSalaireDeclare);
  const ss = roundPayroll(base * r.cnssPatronaleSecuriteSociale);
  const at = roundPayroll(base * r.cnssPatronaleAccidentTravail);
  return [
    {
      nature: 'Sécurité sociale',
      salaireDeclare: base,
      tauxCotisation: r.cnssPatronaleSecuriteSociale * 100,
      montantAPayer: ss,
    },
    {
      nature: 'Accident du travail',
      salaireDeclare: base,
      tauxCotisation: r.cnssPatronaleAccidentTravail * 100,
      montantAPayer: at,
    },
  ];
}

export function quarterMonths(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

export function quarterLabel(quarter: number, year: number): string {
  return `T${quarter} ${year}`;
}

export function computeTfpFoprolos(totalSalaireBrut: number) {
  const r = TUNISIA_PAYROLL_RATES;
  const brut = roundPayroll(totalSalaireBrut);
  return {
    totalBrut: brut,
    tfp: roundPayroll(brut * r.tfp),
    foprolos: roundPayroll(brut * r.foprolos),
  };
}

/**
 * Synthèse fiscale mensuelle pour le tableau de bord (TVA, timbre, retenues).
 */

import { round3 } from '../lib/money';
import { TIMBRE_FISCAL_FACTURE_DT } from '../lib/tunisiaFiscal';
import { listInvoices } from './financeApi';
import { fetchVatMonthlyDeclaration } from './vatDeclarationApi';
import { getTaxDeclarationForPeriod } from './taxDeclarationApi';
import { loadWithholdingCertificates } from './treasuryStorage';

function inPeriod(isoDate: string, mois: number, annee: number): boolean {
  const d = new Date(isoDate);
  return d.getFullYear() === annee && d.getMonth() + 1 === mois;
}

export interface FiscalPeriodSummary {
  mois: number;
  annee: number;
  chiffreAffairesHt: number;
  tvaCollectee: number;
  tvaDeductible: number;
  tvaNetteAPayer: number;
  creditTva: number;
  estCredit: boolean;
  timbresFiscauxAReverser: number;
  /** TCL à payer — saisie manuelle (tax_declarations.tcl_due). */
  tclAPayer: number | null;
  retenuesClientsAEncaisser: number;
  retenuesFournisseursAReverser: number;
  retenuesLoyersAReverser: number;
}

export async function fetchFiscalPeriodSummary(
  companyId: string,
  mois: number,
  annee: number
): Promise<FiscalPeriodSummary> {
  const [declaration, invoices, certificates, savedDeclaration] = await Promise.all([
    fetchVatMonthlyDeclaration(companyId, mois, annee),
    listInvoices(companyId),
    loadWithholdingCertificates(companyId),
    getTaxDeclarationForPeriod(companyId, mois, annee),
  ]);

  const chiffreAffairesHt = round3(
    declaration.collectee.reduce((s, r) => s + r.totalHt, 0)
  );

  const ventesPeriode = invoices.filter(
    (inv) =>
      inv.invoice_type === 'vente' &&
      inv.status !== 'void' &&
      inv.status !== 'draft' &&
      inPeriod(inv.issue_date, mois, annee)
  );

  let timbresFiscauxAReverser = 0;
  for (const inv of ventesPeriode) {
    const meta = (inv.metadata ?? {}) as Record<string, unknown>;
    const timbre = Number(meta.timbre_fiscal);
    if (Number.isFinite(timbre) && timbre > 0) {
      timbresFiscauxAReverser += timbre;
    } else if (meta.apply_timbre_fiscal) {
      timbresFiscauxAReverser += TIMBRE_FISCAL_FACTURE_DT;
    }
  }
  timbresFiscauxAReverser = round3(timbresFiscauxAReverser);

  const certsPeriode = certificates.filter((c) => inPeriod(c.createdAt, mois, annee));

  let retenuesFournisseursAReverser = 0;
  let retenuesClientsAEncaisser = 0;
  let retenuesLoyersAReverser = 0;

  for (const cert of certsPeriode) {
    const total = round3(cert.totalRetenue);
    const isLoyer = cert.lignes.some((l) => l.taux === 10);
    if (isLoyer) {
      retenuesLoyersAReverser += total;
    } else if (cert.mode === 'PAYEUR') {
      retenuesFournisseursAReverser += total;
    } else {
      retenuesClientsAEncaisser += total;
    }
  }

  retenuesFournisseursAReverser = round3(retenuesFournisseursAReverser);
  retenuesClientsAEncaisser = round3(retenuesClientsAEncaisser);
  retenuesLoyersAReverser = round3(retenuesLoyersAReverser);

  const tvaNetteAPayer = declaration.estCredit ? 0 : round3(declaration.solde);
  const creditTva = declaration.estCredit ? round3(Math.abs(declaration.solde)) : 0;

  const tclAPayer =
    savedDeclaration?.tcl_due != null ? round3(Number(savedDeclaration.tcl_due)) : null;

  return {
    mois,
    annee,
    chiffreAffairesHt,
    tvaCollectee: declaration.totalCollectee,
    tvaDeductible: declaration.totalDeductible,
    tvaNetteAPayer,
    creditTva,
    estCredit: declaration.estCredit,
    timbresFiscauxAReverser,
    tclAPayer,
    retenuesClientsAEncaisser,
    retenuesFournisseursAReverser,
    retenuesLoyersAReverser,
  };
}

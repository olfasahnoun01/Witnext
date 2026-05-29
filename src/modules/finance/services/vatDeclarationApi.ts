/**
 * Préparation déclaration TVA mensuelle à partir des factures Finance.
 */

import { listInvoiceLines, listInvoices } from './financeApi';
import { buildVatMonthlyDeclaration } from './financeService';
import type { TauxTvaTunisie, VatMonthlyDeclaration } from '../types/financeDomain';
function inPeriod(dateStr: string, mois: number, annee: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === annee && d.getMonth() + 1 === mois;
}

export async function fetchVatMonthlyDeclaration(
  companyId: string,
  mois: number,
  annee: number
): Promise<VatMonthlyDeclaration> {
  const invoices = await listInvoices(companyId);
  const filtered = invoices.filter(
    (inv) =>
      inv.status !== 'void' &&
      inv.status !== 'draft' &&
      inPeriod(inv.issue_date, mois, annee)
  );
  const lines = await listInvoiceLines(filtered.map((i) => i.id));

  const ventesLignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }> = [];
  const achatsLignes: Array<{ taux: TauxTvaTunisie; ht: number; tva: number }> = [];

  for (const line of lines) {
    const inv = filtered.find((i) => i.id === line.invoice_id);
    if (!inv) continue;
    const taux = Number(line.vat_rate) as TauxTvaTunisie;
    const entry = { taux, ht: Number(line.total_ht), tva: Number(line.total_tva) };
    if (inv.invoice_type === 'vente') ventesLignes.push(entry);
    else achatsLignes.push(entry);
  }

  return buildVatMonthlyDeclaration({
    companyId,
    mois,
    annee,
    ventesLignes: ventesLignes,
    achatsLignes,
    immobilisationsLignes: [],
  });
}

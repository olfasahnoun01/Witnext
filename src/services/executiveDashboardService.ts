import { supabase } from '@/integrations/supabase/client';
import { fetchFiscalPeriodSummary } from '@/modules/finance/services/fiscalPeriodSummary';
import { listInvoices, listPayments } from '@/modules/finance/services/financeApi';
import { round3 } from '@/modules/finance/lib/money';
import { loadMaintenanceRecords } from '@/lib/vehicleMaintenanceStorage';
import { loadVehicleCharges } from '@/lib/vehicleChargesStorage';

export interface CommercialActivitySummary {
  devisEnCours: number;
  commandesOuvertes: number;
  bonsLivraison: number;
  devisMontant: number;
  commandesMontant: number;
}

export interface ExpenseBreakdownItem {
  key: string;
  label: string;
  amount: number;
}

export interface ExpensesSummary {
  carburantMois: number;
  maintenanceMois: number;
  salairesMois: number;
  chargesVehiculeMois: number;
  paiementsSortantsMois: number;
  facturesAchatsMois: number;
  totalChargesMois: number;
  breakdown: ExpenseBreakdownItem[];
}

export interface ExecutiveDashboardSummary {
  mois: number;
  annee: number;
  chiffreAffairesHt: number;
  chiffreAffairesTtc: number;
  encoursClients: number;
  encoursFournisseurs: number;
  commercial: CommercialActivitySummary;
  expenses: ExpensesSummary;
}

function currentPeriod() {
  const now = new Date();
  return { mois: now.getMonth() + 1, annee: now.getFullYear() };
}

function inCurrentMonth(isoDate: string, mois: number, annee: number): boolean {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate);
  return d.getFullYear() === annee && d.getMonth() + 1 === mois;
}

async function sumVehicleChargesForMonth(
  companyId: string,
  mois: number,
  annee: number
): Promise<number> {
  try {
    const charges = await loadVehicleCharges(companyId);
    return round3(
      charges.reduce((s, c) => {
        const date = c.dateEcheance;
        if (!date || !inCurrentMonth(date, mois, annee)) return s;
        const paid = Number(c.montantPaye);
        const amount = Number.isFinite(paid) && paid > 0 ? paid : Number(c.montant ?? 0);
        return s + (Number.isFinite(amount) ? amount : 0);
      }, 0)
    );
  } catch {
    return 0;
  }
}

async function sumMaintenanceForMonth(
  companyId: string,
  mois: number,
  annee: number
): Promise<number> {
  const records = await loadMaintenanceRecords(companyId);
  return round3(
    records.reduce((s, r) => {
      if (r.status === 'annule') return s;
      if (!inCurrentMonth(r.dateDebut, mois, annee)) return s;
      const amount = Number(String(r.coutEstime).replace(',', '.'));
      return s + (Number.isFinite(amount) ? amount : 0);
    }, 0)
  );
}

async function sumPayrollForMonth(
  companyId: string,
  mois: number,
  annee: number
): Promise<number> {
  const { data: period } = await supabase
    .from('payroll_periods')
    .select('id')
    .eq('company_id', companyId)
    .eq('year', annee)
    .eq('month', mois)
    .maybeSingle();

  if (period?.id) {
    const { data: slips } = await supabase
      .from('payroll_slips')
      .select('net_a_payer')
      .eq('period_id', period.id);
    return round3((slips ?? []).reduce((s, r) => s + Number(r.net_a_payer ?? 0), 0));
  }

  const { data: employees } = await supabase
    .from('hr_employees')
    .select('salaire_net')
    .eq('company_id', companyId);

  return round3((employees ?? []).reduce((s, e) => s + Number(e.salaire_net ?? 0), 0));
}

export async function fetchExecutiveDashboardSummary(
  companyId: string
): Promise<ExecutiveDashboardSummary> {
  const { mois, annee } = currentPeriod();
  const monthStart = `${annee}-${String(mois).padStart(2, '0')}-01`;

  const [fiscal, invoices, payments, devisRes, fuelRes, salairesMois] = await Promise.all([
    fetchFiscalPeriodSummary(companyId, mois, annee),
    listInvoices(companyId),
    listPayments(companyId),
    supabase
      .from('devis')
      .select('id, type, is_bc, is_bl, is_ba, status, total_amount, devis_date')
      .eq('company_id', companyId),
    supabase
      .from('fuel_vouchers')
      .select('montant, date')
      .eq('company_id', companyId)
      .gte('date', monthStart),
    sumPayrollForMonth(companyId, mois, annee),
  ]);

  if (devisRes.error) throw devisRes.error;
  if (fuelRes.error) throw fuelRes.error;

  const devisRows = devisRes.data ?? [];
  const venteDevis = devisRows.filter(
    (d) =>
      d.type === 'vente' &&
      !d.is_ba &&
      d.status !== 'annulé' &&
      d.status !== 'annule'
  );

  const devisEnCours = venteDevis.filter((d) => !d.is_bc && !d.is_bl).length;
  const commandesOuvertes = venteDevis.filter((d) => d.is_bc && !d.is_bl).length;
  const bonsLivraison = venteDevis.filter((d) => d.is_bl).length;

  const sumAmount = (rows: typeof venteDevis) =>
    round3(rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0));

  const activeInvoices = invoices.filter((i) => i.status !== 'void' && i.status !== 'draft');

  const venteMois = activeInvoices.filter(
    (i) => i.invoice_type === 'vente' && inCurrentMonth(i.issue_date, mois, annee)
  );
  const achatMois = activeInvoices.filter(
    (i) => i.invoice_type === 'achat' && inCurrentMonth(i.issue_date, mois, annee)
  );

  const chiffreAffairesTtc = round3(venteMois.reduce((s, i) => s + Number(i.total_ttc ?? 0), 0));

  const encoursClients = round3(
    activeInvoices
      .filter((i) => i.invoice_type === 'vente' && i.status !== 'paid')
      .reduce((s, i) => s + Math.max(0, Number(i.total_ttc ?? 0) - Number(i.amount_paid ?? 0)), 0)
  );

  const encoursFournisseurs = round3(
    activeInvoices
      .filter((i) => i.invoice_type === 'achat' && i.status !== 'paid')
      .reduce((s, i) => s + Math.max(0, Number(i.total_ttc ?? 0) - Number(i.amount_paid ?? 0)), 0)
  );

  const carburantMois = round3(
    (fuelRes.data ?? []).reduce((s, r) => s + Number(r.montant ?? 0), 0)
  );
  const [maintenanceMois, chargesVehiculeMois] = await Promise.all([
    sumMaintenanceForMonth(companyId, mois, annee),
    sumVehicleChargesForMonth(companyId, mois, annee),
  ]);
  const facturesAchatsMois = round3(
    achatMois.reduce((s, i) => s + Number(i.total_ttc ?? 0), 0)
  );

  const paiementsSortantsMois = round3(
    payments
      .filter(
        (p) =>
          inCurrentMonth(p.payment_date, mois, annee) &&
          (p.direction === 'outbound_supplier' || p.direction === 'internal')
      )
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  );

  const breakdown: ExpenseBreakdownItem[] = [
    { key: 'carburant', label: 'Bons carburant', amount: carburantMois },
    { key: 'maintenance', label: 'Maintenance véhicules', amount: maintenanceMois },
    { key: 'salaires', label: 'Salaires (paie)', amount: salairesMois },
    { key: 'charges_vehicule', label: 'Charges véhicules', amount: chargesVehiculeMois },
    { key: 'paiements', label: 'Paiements sortants (trésorerie)', amount: paiementsSortantsMois },
    { key: 'achats', label: 'Factures achats (engagées)', amount: facturesAchatsMois },
  ].filter((item) => item.amount > 0);

  const totalChargesMois = round3(
    carburantMois +
      maintenanceMois +
      salairesMois +
      chargesVehiculeMois +
      paiementsSortantsMois
  );

  return {
    mois,
    annee,
    chiffreAffairesHt: fiscal.chiffreAffairesHt,
    chiffreAffairesTtc,
    encoursClients,
    encoursFournisseurs,
    commercial: {
      devisEnCours,
      commandesOuvertes,
      bonsLivraison,
      devisMontant: sumAmount(venteDevis.filter((d) => !d.is_bc && !d.is_bl)),
      commandesMontant: sumAmount(venteDevis.filter((d) => d.is_bc && !d.is_bl)),
    },
    expenses: {
      carburantMois,
      maintenanceMois,
      salairesMois,
      chargesVehiculeMois,
      paiementsSortantsMois,
      facturesAchatsMois,
      totalChargesMois,
      breakdown,
    },
  };
}

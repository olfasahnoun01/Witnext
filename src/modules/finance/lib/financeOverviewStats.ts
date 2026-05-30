import { round3 } from './money';
import type { FinanceInvoiceStatus, InvoiceRow, PaymentRow } from '../types';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyTradingPoint {
  month: string;
  label: string;
  encaissements: number;
  decaissements: number;
  net: number;
  /** Position cumulative (style courbe trading) */
  close: number;
  open: number;
  high: number;
  low: number;
}

const STATUS_LABELS: Record<FinanceInvoiceStatus, string> = {
  draft: 'Brouillon',
  issued: 'Validée',
  partial: 'Partielle',
  paid: 'Payée',
  void: 'Annulée',
};

const STATUS_COLORS: Record<FinanceInvoiceStatus, string> = {
  draft: 'hsl(215, 16%, 55%)',
  issued: 'hsl(217, 91%, 55%)',
  partial: 'hsl(38, 92%, 50%)',
  paid: 'hsl(142, 71%, 42%)',
  void: 'hsl(0, 72%, 55%)',
};

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-TN', { month: 'short', year: '2-digit' });
}

function lastNMonths(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/** Donut — répartition des factures vente par statut (montant TTC). */
export function buildSalesStatusDonut(invoices: InvoiceRow[]): DonutSlice[] {
  const sales = invoices.filter((i) => i.invoice_type === 'vente' && i.status !== 'void');
  const byStatus = new Map<FinanceInvoiceStatus, number>();

  for (const inv of sales) {
    const cur = byStatus.get(inv.status) ?? 0;
    byStatus.set(inv.status, round3(cur + Number(inv.total_ttc)));
  }

  return (['paid', 'partial', 'issued', 'draft'] as FinanceInvoiceStatus[])
    .map((status) => ({
      name: STATUS_LABELS[status],
      value: byStatus.get(status) ?? 0,
      color: STATUS_COLORS[status],
    }))
    .filter((s) => s.value > 0);
}

/** Donut — recettes (ventes) vs charges (achats) en TTC. */
export function buildRevenueExpenseDonut(
  saleInvoices: InvoiceRow[],
  purchaseInvoices: InvoiceRow[]
): DonutSlice[] {
  const sales = saleInvoices
    .filter((i) => i.status !== 'void')
    .reduce((s, i) => s + Number(i.total_ttc), 0);
  const purchases = purchaseInvoices
    .filter((i) => i.status !== 'void')
    .reduce((s, i) => s + Number(i.total_ttc), 0);

  const slices: DonutSlice[] = [];
  if (sales > 0) {
    slices.push({ name: 'Ventes (TTC)', value: round3(sales), color: 'hsl(142, 71%, 42%)' });
  }
  if (purchases > 0) {
    slices.push({ name: 'Achats (TTC)', value: round3(purchases), color: 'hsl(0, 72%, 55%)' });
  }
  return slices;
}

/** Donut — encaissements vs décaissements (règlements enregistrés). */
export function buildPaymentsDonut(payments: PaymentRow[]): DonutSlice[] {
  let inbound = 0;
  let outbound = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    if (p.direction === 'inbound_client') inbound += amt;
    else if (p.direction === 'outbound_supplier') outbound += amt;
  }
  const slices: DonutSlice[] = [];
  if (inbound > 0) {
    slices.push({ name: 'Encaissements', value: round3(inbound), color: 'hsl(142, 71%, 42%)' });
  }
  if (outbound > 0) {
    slices.push({ name: 'Décaissements', value: round3(outbound), color: 'hsl(0, 72%, 55%)' });
  }
  return slices;
}

/** Série mensuelle style trading : flux + position cumulative. */
export function buildMonthlyTradingSeries(payments: PaymentRow[], months = 12): MonthlyTradingPoint[] {
  const keys = lastNMonths(months);
  const encByMonth = new Map<string, number>();
  const decByMonth = new Map<string, number>();

  for (const p of payments) {
    const key = monthKey(p.payment_date);
    const amt = Number(p.amount);
    if (p.direction === 'inbound_client') {
      encByMonth.set(key, round3((encByMonth.get(key) ?? 0) + amt));
    } else if (p.direction === 'outbound_supplier') {
      decByMonth.set(key, round3((decByMonth.get(key) ?? 0) + amt));
    }
  }

  let cumulative = 0;
  return keys.map((month) => {
    const encaissements = encByMonth.get(month) ?? 0;
    const decaissements = decByMonth.get(month) ?? 0;
    const net = round3(encaissements - decaissements);
    const open = cumulative;
    cumulative = round3(cumulative + net);
    const close = cumulative;
    const high = round3(Math.max(open, close, encaissements));
    const low = round3(Math.min(open, close, decaissements > 0 ? -decaissements : Math.min(open, close)));

    return {
      month,
      label: monthLabel(month),
      encaissements,
      decaissements,
      net,
      open,
      close,
      high,
      low,
    };
  });
}

export function sumSalesTtc(invoices: InvoiceRow[]): number {
  return round3(
    invoices
      .filter((i) => i.invoice_type === 'vente' && i.status !== 'void')
      .reduce((s, i) => s + Number(i.total_ttc), 0)
  );
}

export function sumPurchasesTtc(invoices: InvoiceRow[]): number {
  return round3(
    invoices
      .filter((i) => i.invoice_type === 'achat' && i.status !== 'void')
      .reduce((s, i) => s + Number(i.total_ttc), 0)
  );
}

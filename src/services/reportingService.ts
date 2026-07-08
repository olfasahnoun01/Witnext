import { listInvoices, listInvoiceLines } from '@/modules/finance/services/financeApi';
import { round3 } from '@/modules/finance/lib/money';
import type { InvoiceRow } from '@/modules/finance/types';

export type ReportPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface PeriodRange {
  label: string;
  start: string;
  end: string;
}

export interface RevenuePeriodRow {
  label: string;
  caHt: number;
  caTtc: number;
  invoiceCount: number;
}

export interface ProductSalesRow {
  productCode: string;
  description: string;
  quantity: number;
  caHt: number;
  caTtc: number;
}

export interface CounterpartyLedgerRow {
  name: string;
  totalTtc: number;
  paid: number;
  balance: number;
  invoiceCount: number;
}

function parseDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const d = parseDate(iso);
  return d >= start && d <= end;
}

export function buildPeriodRanges(
  period: ReportPeriod,
  year: number,
  month = new Date().getMonth() + 1
): PeriodRange[] {
  if (period === 'monthly') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const lastDay = new Date(year, m, 0).getDate();
      return {
        label: `${String(m).padStart(2, '0')}/${year}`,
        start: `${year}-${String(m).padStart(2, '0')}-01`,
        end: `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    });
  }

  if (period === 'quarterly') {
    return [1, 2, 3, 4].map((q) => {
      const startM = (q - 1) * 3 + 1;
      const endM = q * 3;
      const lastDay = new Date(year, endM, 0).getDate();
      return {
        label: `T${q} ${year}`,
        start: `${year}-${String(startM).padStart(2, '0')}-01`,
        end: `${year}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    });
  }

  if (period === 'semiannual') {
    return [
      {
        label: `S1 ${year}`,
        start: `${year}-01-01`,
        end: `${year}-06-30`,
      },
      {
        label: `S2 ${year}`,
        start: `${year}-07-01`,
        end: `${year}-12-31`,
      },
    ];
  }

  return [
    {
      label: String(year),
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    },
  ];
}

function activeVenteInvoices(invoices: InvoiceRow[]): InvoiceRow[] {
  return invoices.filter(
    (i) => i.invoice_type === 'vente' && i.status !== 'void' && i.status !== 'draft'
  );
}

function activeAchatInvoices(invoices: InvoiceRow[]): InvoiceRow[] {
  return invoices.filter(
    (i) => i.invoice_type === 'achat' && i.status !== 'void' && i.status !== 'draft'
  );
}

export function computeRevenueByPeriod(
  invoices: InvoiceRow[],
  ranges: PeriodRange[]
): RevenuePeriodRow[] {
  const vente = activeVenteInvoices(invoices);
  return ranges.map((range) => {
    const start = parseDate(range.start);
    const end = parseDate(range.end);
    const rows = vente.filter((i) => inRange(i.issue_date, start, end));
    return {
      label: range.label,
      caHt: round3(rows.reduce((s, i) => s + Number(i.total_ht ?? 0), 0)),
      caTtc: round3(rows.reduce((s, i) => s + Number(i.total_ttc ?? 0), 0)),
      invoiceCount: rows.length,
    };
  });
}

export function computeProductSales(
  invoices: InvoiceRow[],
  lines: Awaited<ReturnType<typeof listInvoiceLines>>,
  range?: PeriodRange
): ProductSalesRow[] {
  const venteIds = new Set(
    activeVenteInvoices(invoices)
      .filter((i) => {
        if (!range) return true;
        return inRange(i.issue_date, parseDate(range.start), parseDate(range.end));
      })
      .map((i) => i.id)
  );

  const map = new Map<string, ProductSalesRow>();
  for (const line of lines) {
    if (!venteIds.has(line.invoice_id)) continue;
    const key = line.product_code?.trim() || line.description.trim() || '—';
    const existing = map.get(key) ?? {
      productCode: line.product_code ?? '—',
      description: line.description,
      quantity: 0,
      caHt: 0,
      caTtc: 0,
    };
    existing.quantity += Number(line.quantity ?? 0);
    existing.caHt = round3(existing.caHt + Number(line.total_ht ?? 0));
    existing.caTtc = round3(existing.caTtc + Number(line.total_ht ?? 0) + Number(line.total_tva ?? 0));
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => b.caHt - a.caHt);
}

export function computeClientLedger(invoices: InvoiceRow[]): CounterpartyLedgerRow[] {
  const map = new Map<string, CounterpartyLedgerRow>();
  for (const inv of activeVenteInvoices(invoices)) {
    const name = inv.counterpart_name?.trim() || 'Client non renseigné';
    const row = map.get(name) ?? { name, totalTtc: 0, paid: 0, balance: 0, invoiceCount: 0 };
    const ttc = Number(inv.total_ttc ?? 0);
    const paid = Number(inv.amount_paid ?? 0);
    row.totalTtc = round3(row.totalTtc + ttc);
    row.paid = round3(row.paid + paid);
    row.balance = round3(row.balance + Math.max(0, ttc - paid));
    row.invoiceCount += 1;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

export function computeSupplierLedger(invoices: InvoiceRow[]): CounterpartyLedgerRow[] {
  const map = new Map<string, CounterpartyLedgerRow>();
  for (const inv of activeAchatInvoices(invoices)) {
    const name = inv.counterpart_name?.trim() || 'Fournisseur non renseigné';
    const row = map.get(name) ?? { name, totalTtc: 0, paid: 0, balance: 0, invoiceCount: 0 };
    const ttc = Number(inv.total_ttc ?? 0);
    const paid = Number(inv.amount_paid ?? 0);
    row.totalTtc = round3(row.totalTtc + ttc);
    row.paid = round3(row.paid + paid);
    row.balance = round3(row.balance + Math.max(0, ttc - paid));
    row.invoiceCount += 1;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

export async function loadReportingData(companyId: string) {
  const invoices = await listInvoices(companyId);
  const lines = await listInvoiceLines(invoices.map((i) => i.id));
  return { invoices, lines };
}

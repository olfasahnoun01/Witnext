/**
 * Balance âgée clients / fournisseurs — créances et dettes par tranche d'échéance.
 */

import { round3 } from '../lib/money';
import type { InvoiceRow } from '../types';

export type AgingBucket = 'courant' | 'j1_30' | 'j31_60' | 'j61_90' | 'plus_90';

export interface AgedBalanceLine {
  counterpartName: string;
  counterpartTaxId: string | null;
  invoiceId: string;
  numero: string;
  issueDate: string;
  dueDate: string | null;
  totalTtc: number;
  resteAPayer: number;
  bucket: AgingBucket;
  joursRetard: number;
}

export interface AgedBalanceSummary {
  counterpartName: string;
  courant: number;
  j1_30: number;
  j31_60: number;
  j61_90: number;
  plus_90: number;
  total: number;
}

function bucketFromDays(days: number): AgingBucket {
  if (days <= 0) return 'courant';
  if (days <= 30) return 'j1_30';
  if (days <= 60) return 'j31_60';
  if (days <= 90) return 'j61_90';
  return 'plus_90';
}

/**
 * Construit les lignes de balance âgée à partir des factures non soldées.
 */
export function buildAgedBalanceLines(
  invoices: InvoiceRow[],
  referenceDate = new Date()
): AgedBalanceLine[] {
  const ref = referenceDate.getTime();
  return invoices
    .filter((inv) => ['issued', 'partial'].includes(inv.status))
    .map((inv) => {
      const reste = round3(Math.max(0, Number(inv.total_ttc) - Number(inv.amount_paid)));
      const due = inv.due_date ? new Date(inv.due_date).getTime() : new Date(inv.issue_date).getTime();
      const joursRetard = Math.max(0, Math.floor((ref - due) / (1000 * 60 * 60 * 24)));
      return {
        counterpartName: inv.counterpart_name || '—',
        counterpartTaxId: inv.counterpart_tax_id,
        invoiceId: inv.id,
        numero: inv.numero,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        totalTtc: Number(inv.total_ttc),
        resteAPayer: reste,
        bucket: bucketFromDays(joursRetard),
        joursRetard,
      };
    })
    .filter((l) => l.resteAPayer > 0)
    .sort((a, b) => b.joursRetard - a.joursRetard);
}

export function summarizeAgedByCounterparty(lines: AgedBalanceLine[]): AgedBalanceSummary[] {
  const map = new Map<string, AgedBalanceSummary>();
  for (const line of lines) {
    const key = line.counterpartName;
    const cur =
      map.get(key) ??
      {
        counterpartName: key,
        courant: 0,
        j1_30: 0,
        j31_60: 0,
        j61_90: 0,
        plus_90: 0,
        total: 0,
      };
    cur[line.bucket] = round3(cur[line.bucket] + line.resteAPayer);
    cur.total = round3(cur.total + line.resteAPayer);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

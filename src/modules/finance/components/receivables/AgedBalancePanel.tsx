import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt } from '../../lib/money';
import { FinanceAmount } from '../shared/FinanceAmount';
import type { FinanceAmountKind } from '../../lib/money';
import type { InvoiceRow } from '../../types';
import { buildAgedBalanceLines, summarizeAgedByCounterparty } from '../../services/agedBalanceService';

interface AgedBalancePanelProps {
  saleInvoices: InvoiceRow[];
  purchaseInvoices: InvoiceRow[];
}

const BUCKET_LABELS: Record<string, string> = {
  courant: 'À échoir',
  j1_30: '1-30 j',
  j31_60: '31-60 j',
  j61_90: '61-90 j',
  plus_90: '> 90 j',
};

/** Balance âgée créances clients et dettes fournisseurs (échéances tunisiennes). */
export function AgedBalancePanel({ saleInvoices, purchaseInvoices }: AgedBalancePanelProps) {
  const [tab, setTab] = useState<'clients' | 'fournisseurs'>('clients');

  const lines = useMemo(
    () =>
      buildAgedBalanceLines(tab === 'clients' ? saleInvoices : purchaseInvoices),
    [tab, saleInvoices, purchaseInvoices]
  );
  const summary = useMemo(() => summarizeAgedByCounterparty(lines), [lines]);
  const amountKind: FinanceAmountKind = tab === 'clients' ? 'income' : 'charge';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance âgée</CardTitle>
        <CardDescription>
          Analyse des encours par tranche de retard — base date d&apos;échéance (loi tunisienne : suivi créances).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="clients">Créances clients</TabsTrigger>
            <TabsTrigger value="fournisseurs">Dettes fournisseurs</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-6">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiers</TableHead>
                    <TableHead className="text-right">À échoir</TableHead>
                    <TableHead className="text-right">1-30 j</TableHead>
                    <TableHead className="text-right">31-60 j</TableHead>
                    <TableHead className="text-right">61-90 j</TableHead>
                    <TableHead className="text-right">&gt; 90 j</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun encours.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.map((s) => (
                      <TableRow key={s.counterpartName}>
                        <TableCell className="font-medium">{s.counterpartName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMontantDt(s.courant)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMontantDt(s.j1_30)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMontantDt(s.j31_60)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMontantDt(s.j61_90)}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {formatMontantDt(s.plus_90)}
                        </TableCell>
                        <TableCell className="text-right">
                          <FinanceAmount amount={s.total} kind={amountKind} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Détail par facture</summary>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Tiers</TableHead>
                    <TableHead>Tranche</TableHead>
                    <TableHead className="text-right">Reste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.invoiceId}>
                      <TableCell className="font-mono">{l.numero}</TableCell>
                      <TableCell>{l.counterpartName}</TableCell>
                      <TableCell>{BUCKET_LABELS[l.bucket]}</TableCell>
                      <TableCell className="text-right">
                        <FinanceAmount amount={l.resteAPayer} kind={amountKind} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

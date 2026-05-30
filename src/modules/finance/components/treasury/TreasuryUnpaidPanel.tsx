import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatMontantDt } from '../../lib/money';
import { loadBankFees } from '../../services/bankFeesStorage';
import { parsePaymentMeta, REGLEMENT_STATUS_LABELS } from '../../services/paymentService';
import type { PaymentRow } from '../../types';

interface TreasuryUnpaidPanelProps {
  companyId: string;
  payments: PaymentRow[];
}

export function TreasuryUnpaidPanel({ companyId, payments }: TreasuryUnpaidPanelProps) {
  const [monthFilter, setMonthFilter] = useState('');

  const unpaidBankFees = useMemo(
    () => loadBankFees(companyId).filter((f) => f.status === 'IMPAYEE'),
    [companyId]
  );

  const unpaidPayments = useMemo(() => {
    return payments
      .map((p) => {
        const meta = parsePaymentMeta(p.notes);
        if (!meta) return null;
        const isUnpaid =
          meta.reglementStatus === 'IMPAYEE' || meta.traitStatus === 'IMPAYE';
        if (!isUnpaid) return null;
        return {
          id: p.id,
          date: p.payment_date,
          dateEcheance: meta.dateEcheance,
          counterparty: p.counterparty_name,
          amount: Number(p.amount),
          mode: meta.modeReglement,
          status: meta.reglementStatus ?? 'IMPAYEE',
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      date: string;
      dateEcheance: string | null | undefined;
      counterparty: string | null;
      amount: number;
      mode: string;
      status: string;
    }>;
  }, [payments]);

  const filterByMonth = (dateStr: string | null | undefined) => {
    if (!monthFilter) return true;
    const d = dateStr || '';
    return d.startsWith(monthFilter);
  };

  const filteredFees = unpaidBankFees.filter((f) => filterByMonth(f.dateEcheance || f.dateOperation));
  const filteredPayments = unpaidPayments.filter((p) => filterByMonth(p.dateEcheance || p.date));

  const totalFees = filteredFees.reduce((s, f) => s + f.montantTtc, 0);
  const totalPayments = filteredPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Impayée — charges et règlements
          </CardTitle>
          <CardDescription>
            Frais bancaires et règlements déclarés impayés. Filtrez par mois d&apos;échéance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label>Mois échéance (AAAA-MM)</Label>
            <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm tabular-nums">
              Total frais impayés : <strong>{formatMontantDt(totalFees)}</strong>
            </p>
            <p className="text-sm tabular-nums">
              Total règlements impayés : <strong>{formatMontantDt(totalPayments)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frais bancaires impayés</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun frais impayé pour cette période.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.dateEcheance || f.dateOperation}</TableCell>
                    <TableCell>{f.treasuryAccountName}</TableCell>
                    <TableCell>{f.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMontantDt(f.montantTtc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Règlements impayés</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun règlement impayé pour cette période.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.dateEcheance || p.date}</TableCell>
                    <TableCell>{p.counterparty || '—'}</TableCell>
                    <TableCell>{p.mode}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMontantDt(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {REGLEMENT_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

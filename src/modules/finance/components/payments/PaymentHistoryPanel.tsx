import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  MODE_REGLEMENT_LABELS,
  parsePaymentMeta,
  REGLEMENT_STATUS_LABELS,
} from '../../services/paymentService';
import type { PaymentRow } from '../../types';
import type { ReglementStatus } from '../../types/paymentTypes';

interface PaymentHistoryPanelProps {
  title: string;
  loading: boolean;
  payments: PaymentRow[];
}

export function PaymentHistoryPanel({ title, loading, payments }: PaymentHistoryPanelProps) {
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReglementStatus>('all');

  const rows = useMemo(() => {
    return payments.map((p) => {
      const meta = parsePaymentMeta(p.notes);
      return {
        id: p.id,
        payment_date: p.payment_date,
        counterparty_name: p.counterparty_name,
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference,
        dateEcheance: meta?.dateEcheance ?? '',
        modeLabel: meta?.modeReglement ? MODE_REGLEMENT_LABELS[meta.modeReglement] : p.method,
        reglementStatus: meta?.reglementStatus ?? null,
      };
    });
  }, [payments]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchMonth =
        !monthFilter ||
        (r.dateEcheance && r.dateEcheance.startsWith(monthFilter)) ||
        r.payment_date.startsWith(monthFilter);
      const matchStatus = statusFilter === 'all' || r.reglementStatus === statusFilter;
      return matchMonth && matchStatus;
    });
  }, [rows, monthFilter, statusFilter]);

  const totalDue = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Mois échéance</Label>
            <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Statut</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="PAYEE">Payée</SelectItem>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="IMPAYEE">Impayée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {monthFilter && (
            <p className="text-sm tabular-nums ml-auto">
              Total période : <strong>{formatMontantDt(totalDue)}</strong>
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun règlement.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date op.</TableHead>
                  <TableHead>Date échéance</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Réf.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.payment_date}</TableCell>
                    <TableCell>{r.dateEcheance || '—'}</TableCell>
                    <TableCell>{r.counterparty_name || '—'}</TableCell>
                    <TableCell className="tabular-nums">{formatMontantDt(r.amount)}</TableCell>
                    <TableCell>{r.modeLabel}</TableCell>
                    <TableCell>
                      {r.reglementStatus ? (
                        <Badge
                          variant={
                            r.reglementStatus === 'IMPAYEE'
                              ? 'destructive'
                              : r.reglementStatus === 'EN_COURS'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {REGLEMENT_STATUS_LABELS[r.reglementStatus]}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.reference || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

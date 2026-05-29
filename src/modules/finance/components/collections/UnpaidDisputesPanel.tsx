import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt } from '../../lib/money';
import type { InvoiceRow } from '../../types';

interface UnpaidDisputesPanelProps {
  invoices: InvoiceRow[];
}

/**
 * Suivi des litiges / impayés — factures marquées après rejet d'effet ou contentieux.
 */
export function UnpaidDisputesPanel({ invoices }: UnpaidDisputesPanelProps) {
  const disputes = useMemo(() => {
    return invoices.filter((inv) => {
      const meta = (inv.metadata || {}) as Record<string, unknown>;
      return meta.impaye_at || meta.dispute_status === 'litige';
    });
  }, [invoices]);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Litiges & impayés
        </CardTitle>
        <CardDescription>
          Factures réouvertes après rejet de chèque/traite ou mise en contentieux manuelle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dossier en litige actif.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facture</TableHead>
                <TableHead>Tiers</TableHead>
                <TableHead>Reste TTC</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((inv) => {
                const reste = Math.max(0, Number(inv.total_ttc) - Number(inv.amount_paid));
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.numero}</TableCell>
                    <TableCell>{inv.counterpart_name}</TableCell>
                    <TableCell className="tabular-nums">{formatMontantDt(reste)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">Impayé / Litige</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

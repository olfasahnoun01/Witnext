import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt } from '../../lib/money';
import type { InvoiceLetterageRow } from '../../types/paymentTypes';

interface PaymentLetterageTableProps {
  rows: InvoiceLetterageRow[];
  onChange: (rows: InvoiceLetterageRow[]) => void;
  disabled?: boolean;
}

/**
 * Grille de lettrage : factures impayées du tiers avec montant à imputer.
 */
export function PaymentLetterageTable({ rows, onChange, disabled }: PaymentLetterageTableProps) {
  const updateRow = (invoiceId: string, patch: Partial<InvoiceLetterageRow>) => {
    onChange(
      rows.map((r) => (r.invoice.id === invoiceId ? { ...r, ...patch } : r))
    );
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        Aucune facture impayée pour ce tiers. Vérifiez que les factures Finance sont au statut « émise » ou « partielle ».
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Numéro</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Montant TTC</TableHead>
            <TableHead className="text-right">Reste à payer</TableHead>
            <TableHead className="text-right w-[140px]">À imputer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.invoice.id}>
              <TableCell>
                <Checkbox
                  checked={row.selected}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    updateRow(row.invoice.id, {
                      selected: on,
                      montantAImputer: on ? row.resteAPayer : 0,
                    });
                  }}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">{row.invoice.numero}</TableCell>
              <TableCell className="text-sm">{row.invoice.issue_date}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatMontantDt(row.montantInitialTtc)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm font-medium">
                {formatMontantDt(row.resteAPayer)}
              </TableCell>
              <TableCell>
                <Input
                  className="text-right tabular-nums h-9"
                  inputMode="decimal"
                  disabled={disabled || !row.selected}
                  value={row.selected && row.montantAImputer > 0 ? String(row.montantAImputer) : ''}
                  placeholder="0,000"
                  onChange={(e) => {
                    const raw = e.target.value.replace(',', '.');
                    const n = Number(raw);
                    const montant = Number.isFinite(n) ? Math.min(n, row.resteAPayer) : 0;
                    updateRow(row.invoice.id, { montantAImputer: montant, selected: montant > 0 });
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMontantDt } from '../../lib/money';
import type { LetterageLine } from '../../types/financeDomain';

interface FinanceLetterageTableProps {
  lines: LetterageLine[];
  onChange: (lines: LetterageLine[]) => void;
  disabled?: boolean;
}

/**
 * Grille de lettrage : factures impayées + avoirs financiers (crédit).
 */
export function FinanceLetterageTable({ lines, onChange, disabled }: FinanceLetterageTableProps) {
  const updateLine = (id: string, kind: LetterageLine['kind'], patch: Partial<LetterageLine>) => {
    onChange(
      lines.map((l) => (l.id === id && l.kind === kind ? { ...l, ...patch } : l))
    );
  };

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        Aucun document à lettrer pour ce tiers.
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Type</TableHead>
            <TableHead>N° pièce</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total TTC</TableHead>
            <TableHead className="text-right">Reste / Crédit</TableHead>
            <TableHead className="text-right w-[140px]">Imputation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const isAvoir = line.kind === 'AVOIR';
            return (
              <TableRow
                key={`${line.kind}-${line.id}`}
                className={cn(isAvoir && 'bg-blue-500/5')}
              >
                <TableCell>
                  <Checkbox
                    checked={line.selected}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      updateLine(line.id, line.kind, {
                        selected: on,
                        montantAImputer: on ? line.resteAPayer : 0,
                      });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={isAvoir ? 'secondary' : 'outline'}>
                    {isAvoir ? 'Avoir' : 'Facture'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{line.numero}</TableCell>
                <TableCell className="text-sm">{line.date}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-sm',
                    isAvoir && 'text-blue-700 dark:text-blue-400'
                  )}
                >
                  {isAvoir ? `− ${formatMontantDt(line.resteAPayer)}` : formatMontantDt(line.montantTtc)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  {formatMontantDt(line.resteAPayer)}
                </TableCell>
                <TableCell>
                  <Input
                    className="text-right tabular-nums h-9"
                    inputMode="decimal"
                    disabled={disabled || !line.selected}
                    value={line.selected && line.montantAImputer > 0 ? String(line.montantAImputer) : ''}
                    placeholder="0,000"
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      const n = Number(raw);
                      const montant = Number.isFinite(n) ? Math.min(n, line.resteAPayer) : 0;
                      updateLine(line.id, line.kind, {
                        montantAImputer: montant,
                        selected: montant > 0,
                      });
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

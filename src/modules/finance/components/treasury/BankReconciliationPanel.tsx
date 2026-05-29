import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { loadTreasuryAccounts } from '../../services/treasuryStorage';
import {
  loadBankStatementLines,
  parseBankStatementCsv,
  saveBankStatementLines,
  type BankStatementLine,
} from '../../services/bankReconciliationStorage';
import { supabase } from '@/integrations/supabase/client';
import { parseMovementAccountId } from '../../services/treasurySyncApi';

interface BankReconciliationPanelProps {
  companyId: string;
}

/**
 * Rapprochement bancaire visuel : relevé importé ↔ mouvements trésorerie.
 */
export function BankReconciliationPanel({ companyId }: BankReconciliationPanelProps) {
  const [accountId, setAccountId] = useState('');
  const [lines, setLines] = useState<BankStatementLine[]>(() => loadBankStatementLines(companyId));
  const [movements, setMovements] = useState<
    Array<{ id: string; label: string; amount_signed: number; notes: string | null; movement_date: string }>
  >([]);

  const accounts = useMemo(
    () => loadTreasuryAccounts(companyId).filter((a) => a.type === 'BANQUE'),
    [companyId]
  );

  const loadMovements = useCallback(async () => {
    const { data } = await supabase
      .from('treasury_movements')
      .select('id, label, amount_signed, notes, movement_date')
      .eq('company_id', companyId)
      .order('movement_date', { ascending: false })
      .limit(200);
    setMovements(data ?? []);
  }, [companyId]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const filteredLines = accountId ? lines.filter((l) => l.accountId === accountId) : lines;

  const handleImport = (file: File) => {
    if (!accountId) {
      toast.error('Sélectionnez un compte banque.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const imported = parseBankStatementCsv(text, accountId);
      const merged = [...imported, ...lines];
      setLines(merged);
      saveBankStatementLines(companyId, merged);
      toast.success(`${imported.length} ligne(s) importée(s)`);
    };
    reader.readAsText(file);
  };

  const autoMatch = () => {
    let matched = 0;
    const next = lines.map((sl) => {
      if (sl.matchedMovementId || sl.accountId !== accountId) return sl;
      const hit = movements.find(
        (m) =>
          parseMovementAccountId(m.notes) === accountId &&
          Math.abs(Number(m.amount_signed) - sl.amountSigned) < 0.001 &&
          !lines.some((x) => x.matchedMovementId === m.id)
      );
      if (hit) {
        matched += 1;
        return { ...sl, matchedMovementId: hit.id };
      }
      return sl;
    });
    setLines(next);
    saveBankStatementLines(companyId, next);
    toast.success(`${matched} rapprochement(s) automatique(s)`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapprochement bancaire</CardTitle>
        <CardDescription>
          Import CSV (date;libellé;montant) puis rapprochement avec les mouvements enregistrés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <Label>Compte banque</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Compte" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importer CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                  }}
                />
              </span>
            </Button>
          </Label>
          <Button variant="secondary" onClick={autoMatch} className="gap-1">
            <Link2 className="h-4 w-4" />
            Rapprocher auto
          </Button>
        </div>

        <div className="rounded-lg border overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé relevé</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucune ligne de relevé.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((sl) => (
                  <TableRow key={sl.id}>
                    <TableCell>{sl.operationDate}</TableCell>
                    <TableCell>{sl.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMontantDt(sl.amountSigned)}
                    </TableCell>
                    <TableCell>
                      {sl.matchedMovementId ? (
                        <Badge className="gap-1">
                          <Link2 className="h-3 w-3" />
                          Rapproché
                        </Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

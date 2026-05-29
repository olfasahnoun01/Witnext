import { useCallback, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt, round3 } from '../../lib/money';
import { fetchJournalEntriesForStatements } from '../../services/paymentApi';

interface AccountingStatementsPanelProps {
  companyId: string;
}

type JournalLineView = {
  entryDate: string;
  reference: string | null;
  memo: string | null;
  accountCode: string;
  lineMemo: string | null;
  debit: number;
  credit: number;
};

/**
 * États comptables : Journal, Grand livre (solde progressif), Balance.
 */
export function AccountingStatementsPanel({ companyId }: AccountingStatementsPanelProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [accountFilter, setAccountFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<JournalLineView[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { entries, lines: jl } = await fetchJournalEntriesForStatements(
        companyId,
        dateFrom,
        dateTo
      );
      const entryById = Object.fromEntries(entries.map((e) => [e.id, e]));
      const merged: JournalLineView[] = jl.map((l) => {
        const entry = entryById[l.journal_entry_id];
        return {
          entryDate: entry?.entry_date ?? '',
          reference: entry?.reference ?? null,
          memo: entry?.memo ?? null,
          accountCode: l.account_code,
          lineMemo: l.line_memo,
          debit: Number(l.debit),
          credit: Number(l.credit),
        };
      });
      setLines(merged.sort((a, b) => a.entryDate.localeCompare(b.entryDate)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement du journal impossible');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const acc = accountFilter.trim();
    if (!acc) return lines;
    return lines.filter((l) => l.accountCode.startsWith(acc));
  }, [lines, accountFilter]);

  const grandLivre = useMemo(() => {
    let solde = 0;
    return filtered.map((l) => {
      solde = round3(solde + l.debit - l.credit);
      return { ...l, soldeProgressif: solde };
    });
  }, [filtered]);

  const balance = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of filtered) {
      const cur = map.get(l.accountCode) ?? { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      map.set(l.accountCode, cur);
    }
    return [...map.entries()]
      .map(([code, t]) => {
        const net = round3(t.debit - t.credit);
        return {
          code,
          libelle: `Compte ${code}`,
          totalDebit: round3(t.debit),
          totalCredit: round3(t.credit),
          soldeNet: Math.abs(net),
          sens: net >= 0 ? 'Débiteur' : 'Créditeur',
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [filtered]);

  const exportCsv = (filename: string, headers: string[], rows: string[][]) => {
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>États comptables</CardTitle>
          <CardDescription>Journal, grand livre et balance — montants à 3 décimales (DT).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>Date début</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Date fin</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Compte (préfixe)</Label>
            <Input
              placeholder="ex. 411"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={() => void load()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Actualiser
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="grand-livre">Grand livre</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Journal général</CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={filtered.length === 0}
                onClick={() =>
                  exportCsv(
                    `journal-${dateFrom}-${dateTo}.csv`,
                    ['Date', 'Réf', 'Compte', 'Libellé', 'Débit', 'Crédit'],
                    filtered.map((l) => [
                      l.entryDate,
                      l.reference ?? '',
                      l.accountCode,
                      l.lineMemo ?? '',
                      String(l.debit),
                      String(l.credit),
                    ])
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <JournalTable rows={filtered} showSolde={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grand-livre" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grand livre</CardTitle>
              <CardDescription>Solde progressif cumulé par ligne.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead className="text-right">Solde prog.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grandLivre.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune écriture — lancez Actualiser.
                      </TableCell>
                    </TableRow>
                  ) : (
                    grandLivre.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.entryDate}</TableCell>
                        <TableCell className="font-mono">{l.accountCode}</TableCell>
                        <TableCell>{l.lineMemo ?? l.memo}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.debit > 0 ? formatMontantDt(l.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.credit > 0 ? formatMontantDt(l.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMontantDt(l.soldeProgressif)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Balance générale</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Total débit</TableHead>
                    <TableHead className="text-right">Total crédit</TableHead>
                    <TableHead className="text-right">Solde net</TableHead>
                    <TableHead>Sens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune donnée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    balance.map((b) => (
                      <TableRow key={b.code}>
                        <TableCell className="font-mono">{b.code}</TableCell>
                        <TableCell>{b.libelle}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMontantDt(b.totalDebit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMontantDt(b.totalCredit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMontantDt(b.soldeNet)}
                        </TableCell>
                        <TableCell>{b.sens}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JournalTable({
  rows,
  showSolde,
}: {
  rows: JournalLineView[];
  showSolde: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Réf.</TableHead>
          <TableHead>Compte</TableHead>
          <TableHead>Libellé</TableHead>
          <TableHead className="text-right">Débit</TableHead>
          <TableHead className="text-right">Crédit</TableHead>
          {showSolde && <TableHead className="text-right">Solde</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showSolde ? 7 : 6} className="text-center text-muted-foreground py-8">
              Aucune écriture.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((l, i) => (
            <TableRow key={i}>
              <TableCell>{l.entryDate}</TableCell>
              <TableCell className="font-mono text-xs">{l.reference ?? '—'}</TableCell>
              <TableCell className="font-mono">{l.accountCode}</TableCell>
              <TableCell>{l.lineMemo ?? l.memo}</TableCell>
              <TableCell className="text-right tabular-nums">
                {l.debit > 0 ? formatMontantDt(l.debit) : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {l.credit > 0 ? formatMontantDt(l.credit) : '—'}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

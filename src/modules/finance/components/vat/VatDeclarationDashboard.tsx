import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Scale, Send } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { formatMontantDt } from '../../lib/money';
import { fetchVatMonthlyDeclaration } from '../../services/vatDeclarationApi';
import {
  fileTaxDeclaration,
  listTaxDeclarations,
  saveVatDeclarationDraft,
  type TaxDeclarationRow,
} from '../../services/taxDeclarationApi';
import type { VatMonthlyDeclaration } from '../../types/financeDomain';

interface VatDeclarationDashboardProps {
  companyId: string;
}

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function VatAggregateTable({
  title,
  rows,
}: {
  title: string;
  rows: VatMonthlyDeclaration['collectee'];
}) {
  return (
    <div>
      <h4 className="font-medium mb-2">{title}</h4>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Taux</TableHead>
              <TableHead className="text-right">Total HT</TableHead>
              <TableHead className="text-right">TVA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  Aucune ligne sur la période.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.taux}>
                  <TableCell>{r.taux} %</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMontantDt(r.totalHt)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatMontantDt(r.totalTva)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * État de déclaration TVA mensuelle — collectée, déductible, solde.
 */
export function VatDeclarationDashboard({ companyId }: VatDeclarationDashboardProps) {
  const now = new Date();
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [declaration, setDeclaration] = useState<VatMonthlyDeclaration | null>(null);
  const [savedRows, setSavedRows] = useState<TaxDeclarationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listTaxDeclarations(companyId).then(setSavedRows).catch(() => setSavedRows([]));
  }, [companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchVatMonthlyDeclaration(companyId, Number(mois), Number(annee));
      setDeclaration(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Calcul TVA impossible');
      setDeclaration(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, mois, annee]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Déclaration mensuelle de TVA
          </CardTitle>
          <CardDescription>
            TVA collectée (ventes) − TVA déductible (achats + immobilisations). Taux tunisiens : 19 %, 13 %, 7 %, 0 %.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Mois</Label>
            <Select value={mois} onValueChange={setMois}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOIS.map((label, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Année</Label>
            <Select value={annee} onValueChange={setAnnee}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void load()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Calculer
          </Button>
          <Button
            variant="secondary"
            disabled={!declaration || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const row = await saveVatDeclarationDraft(companyId, Number(mois), Number(annee));
                toast.success('Brouillon enregistré (tax_declarations)');
                setSavedRows(await listTaxDeclarations(companyId));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Enregistrement impossible');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Enregistrer brouillon
          </Button>
        </CardContent>
      </Card>

      {savedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique déclarations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {savedRows.slice(0, 6).map((r) => (
              <div key={r.id} className="flex justify-between items-center border-b pb-2">
                <span>
                  {r.period_start} → {r.period_end} — <strong>{r.status}</strong>
                </span>
                <span className="tabular-nums">{formatMontantDt(Number(r.net_vat_due))}</span>
                {r.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await fileTaxDeclaration(r.id);
                      toast.success('Marquée comme déposée');
                      setSavedRows(await listTaxDeclarations(companyId));
                    }}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Déposer
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {declaration && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <VatAggregateTable title="1. TVA collectée (Ventes)" rows={declaration.collectee} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-6">
                <VatAggregateTable
                  title="2. TVA déductible — Achats"
                  rows={declaration.deductibleAchats}
                />
                <VatAggregateTable
                  title="Immobilisations"
                  rows={declaration.deductibleImmobilisations}
                />
              </CardContent>
            </Card>
          </div>

          <Card
            className={cn(
              'border-2',
              declaration.estCredit ? 'border-blue-500/50 bg-blue-500/5' : 'border-red-500/40 bg-red-500/5'
            )}
          >
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">3. Calcul final</h3>
              <div className="grid gap-2 sm:grid-cols-3 text-sm mb-4">
                <p>
                  TVA collectée :{' '}
                  <strong className="tabular-nums">{formatMontantDt(declaration.totalCollectee)}</strong>
                </p>
                <p>
                  TVA déductible :{' '}
                  <strong className="tabular-nums">{formatMontantDt(declaration.totalDeductible)}</strong>
                </p>
              </div>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  declaration.estCredit ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'
                )}
              >
                {declaration.estCredit ? (
                  <>Crédit de TVA : {formatMontantDt(Math.abs(declaration.solde))}</>
                ) : (
                  <>TVA à verser : {formatMontantDt(declaration.solde)}</>
                )}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

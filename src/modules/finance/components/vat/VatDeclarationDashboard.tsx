import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Scale, Send, FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMontantDt, parseMontantInput, round3 } from '../../lib/money';
import { downloadFiscalDashboardPdf, openFiscalDashboardPdfPrint } from '../../lib/fiscalDashboardPdf';
import { FISCAL_LABELS, labelSoldeTva } from '../../lib/fiscalTerminology';
import { FinanceAmount } from '../shared/FinanceAmount';
import { fetchVatMonthlyDeclaration } from '../../services/vatDeclarationApi';
import {
  fetchFiscalPeriodSummary,
  type FiscalPeriodSummary,
} from '../../services/fiscalPeriodSummary';
import {
  fileTaxDeclaration,
  listTaxDeclarations,
  saveTclDue,
  saveVatDeclarationDraft,
  type TaxDeclarationRow,
} from '../../services/taxDeclarationApi';
import type { VatMonthlyDeclaration } from '../../types/financeDomain';

interface VatDeclarationDashboardProps {
  companyId: string;
  companyName: string;
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
  const totalBase = round3(rows.reduce((s, r) => s + r.totalHt, 0));
  const totalTva = round3(rows.reduce((s, r) => s + r.totalTva, 0));

  return (
    <div>
      <h4 className="font-medium mb-2">{title}</h4>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>TVA %</TableHead>
              <TableHead className="text-right">Base HTVA</TableHead>
              <TableHead className="text-right">Montant TVA</TableHead>
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
          {rows.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/20 font-semibold">
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  <span className="text-xs font-normal text-muted-foreground block mb-0.5">
                    Totale base HTVA
                  </span>
                  {formatMontantDt(totalBase)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="text-xs font-normal text-muted-foreground block mb-0.5">
                    Totale montant TVA
                  </span>
                  {formatMontantDt(totalTva)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

function FiscalSummaryRow({
  label,
  amount,
  kind,
  note,
}: {
  label: string;
  amount: number | null;
  kind?: 'income' | 'charge' | 'neutral';
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2 border-b last:border-b-0">
      <div>
        <p className="font-medium">{label}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {amount === null ? (
        <span className="text-sm text-muted-foreground italic">Non calculé</span>
      ) : kind ? (
        <FinanceAmount amount={amount} kind={kind} className="text-base font-semibold" />
      ) : (
        <span className="text-base font-semibold tabular-nums">{formatMontantDt(amount)}</span>
      )}
    </div>
  );
}

/**
 * Tableau de bord fiscal et déclaration TVA mensuelle (normes comptables tunisiennes).
 */
export function VatDeclarationDashboard({ companyId, companyName }: VatDeclarationDashboardProps) {
  const now = new Date();
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [declaration, setDeclaration] = useState<VatMonthlyDeclaration | null>(null);
  const [summary, setSummary] = useState<FiscalPeriodSummary | null>(null);
  const [tclInput, setTclInput] = useState('');
  const [savedRows, setSavedRows] = useState<TaxDeclarationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTcl, setSavingTcl] = useState(false);

  useEffect(() => {
    void listTaxDeclarations(companyId).then(setSavedRows).catch(() => setSavedRows([]));
  }, [companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = Number(mois);
      const y = Number(annee);
      const [d, s] = await Promise.all([
        fetchVatMonthlyDeclaration(companyId, m, y),
        fetchFiscalPeriodSummary(companyId, m, y),
      ]);
      setDeclaration(d);
      setSummary(s);
      setTclInput(s.tclAPayer != null ? String(s.tclAPayer) : '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Calcul fiscal impossible');
      setDeclaration(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, mois, annee]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const buildPdfData = () => {
    if (!summary) return null;
    const tclParsed = parseMontantInput(tclInput);
    const summaryForPdf: FiscalPeriodSummary = {
      ...summary,
      tclAPayer: tclParsed ?? summary.tclAPayer,
    };
    return {
      companyName,
      moisLabel: MOIS[summary.mois - 1],
      annee: summary.annee,
      summary: summaryForPdf,
      declaration,
    };
  };

  const handleSaveTcl = async () => {
    const parsed = parseMontantInput(tclInput);
    if (parsed === null || parsed < 0) {
      toast.error('Saisissez un montant TCL valide (≥ 0)');
      return;
    }
    setSavingTcl(true);
    try {
      await saveTclDue(companyId, Number(mois), Number(annee), parsed);
      setSummary((prev) => (prev ? { ...prev, tclAPayer: parsed } : prev));
      setSavedRows(await listTaxDeclarations(companyId));
      toast.success(`${FISCAL_LABELS.tclAPayer} enregistré`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement TCL impossible');
    } finally {
      setSavingTcl(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            {FISCAL_LABELS.tableauDeBordFiscal}
          </CardTitle>
          <CardDescription>
            {FISCAL_LABELS.tvaFormule}. Taux tunisiens : 19 %, 13 %, 7 %, 0 %.
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
                const tclParsed = parseMontantInput(tclInput);
                await saveVatDeclarationDraft(companyId, Number(mois), Number(annee), {
                  tclDue: tclParsed,
                });
                toast.success('Brouillon enregistré');
                setSavedRows(await listTaxDeclarations(companyId));
                if (summary && tclParsed != null) {
                  setSummary({ ...summary, tclAPayer: tclParsed });
                }
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

      {summary && (
        <Card className="border-violet-500/30">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{FISCAL_LABELS.tableauDeBordFiscal}</CardTitle>
              <CardDescription>
                {MOIS[summary.mois - 1]} {summary.annee} — synthèse fiscale mensuelle
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const pdf = buildPdfData();
                  if (pdf) downloadFiscalDashboardPdf(pdf);
                }}
              >
                <FileDown className="h-4 w-4" />
                Télécharger PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  const pdf = buildPdfData();
                  if (pdf) openFiscalDashboardPdfPrint(pdf);
                }}
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <FiscalSummaryRow
              label={FISCAL_LABELS.chiffreAffairesHt}
              amount={summary.chiffreAffairesHt}
              kind="income"
            />
            <FiscalSummaryRow
              label={FISCAL_LABELS.tvaCollectee}
              amount={summary.tvaCollectee}
              kind="income"
            />
            <FiscalSummaryRow
              label={FISCAL_LABELS.tvaDeductible}
              amount={summary.tvaDeductible}
              kind="charge"
            />
            {summary.estCredit ? (
              <FiscalSummaryRow
                label={FISCAL_LABELS.creditTva}
                amount={summary.creditTva}
                kind="neutral"
              />
            ) : (
              <FiscalSummaryRow
                label={FISCAL_LABELS.tvaNetteAPayer}
                amount={summary.tvaNetteAPayer}
                kind="charge"
              />
            )}
            <FiscalSummaryRow
              label={FISCAL_LABELS.tclAPayer}
              amount={parseMontantInput(tclInput) ?? summary.tclAPayer}
              kind="charge"
            />
            <div className="flex flex-wrap items-end gap-3 pt-3 mt-2 border-t">
              <div className="space-y-2 flex-1 min-w-[180px]">
                <Label htmlFor="tcl-due">{FISCAL_LABELS.tclAPayer} (saisie)</Label>
                <Input
                  id="tcl-due"
                  inputMode="decimal"
                  placeholder="0,000"
                  value={tclInput}
                  onChange={(e) => setTclInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Taxe sur les conventions de prêt — montant déclaré manuellement.
                </p>
              </div>
              <Button variant="secondary" disabled={savingTcl} onClick={() => void handleSaveTcl()}>
                {savingTcl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer TCL
              </Button>
            </div>
            <FiscalSummaryRow
              label={FISCAL_LABELS.timbresFiscauxAReverser}
              amount={summary.timbresFiscauxAReverser}
              kind="charge"
            />
            <FiscalSummaryRow
              label={FISCAL_LABELS.retenuesClientsAEncaisser}
              amount={summary.retenuesClientsAEncaisser}
              kind="income"
            />
            <FiscalSummaryRow
              label={FISCAL_LABELS.retenuesFournisseursAReverser}
              amount={summary.retenuesFournisseursAReverser}
              kind="charge"
            />
            <FiscalSummaryRow
              label={FISCAL_LABELS.retenuesLoyersAReverser}
              amount={summary.retenuesLoyersAReverser}
              kind="charge"
            />
          </CardContent>
        </Card>
      )}

      {savedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des déclarations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {savedRows.slice(0, 6).map((r) => (
              <div key={r.id} className="flex justify-between items-center border-b pb-2">
                <span>
                  {r.period_start} → {r.period_end} — <strong>{r.status}</strong>
                  {r.notes && <span className="text-muted-foreground ml-2">({r.notes})</span>}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{FISCAL_LABELS.declarationMensuelleTva}</CardTitle>
              <CardDescription>Détail par taux de TVA — ventes, achats et immobilisations</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <VatAggregateTable
                  title={`1. ${FISCAL_LABELS.tvaCollectee}`}
                  rows={declaration.collectee}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-6">
                <VatAggregateTable
                  title={`2. ${FISCAL_LABELS.tvaDeductible} — Achats`}
                  rows={declaration.deductibleAchats}
                />
                <VatAggregateTable
                  title={`${FISCAL_LABELS.tvaDeductible} — Immobilisations`}
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
              <h3 className="text-lg font-semibold mb-4">3. Solde TVA</h3>
              <div className="grid gap-2 sm:grid-cols-3 text-sm mb-4">
                <p>
                  {FISCAL_LABELS.tvaCollectee} :{' '}
                  <FinanceAmount amount={declaration.totalCollectee} kind="income" />
                </p>
                <p>
                  {FISCAL_LABELS.tvaDeductible} :{' '}
                  <FinanceAmount amount={declaration.totalDeductible} kind="charge" />
                </p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{FISCAL_LABELS.tvaFormule}</p>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  declaration.estCredit ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'
                )}
              >
                {labelSoldeTva(declaration.solde, declaration.estCredit)} :{' '}
                {formatMontantDt(Math.abs(declaration.solde))}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

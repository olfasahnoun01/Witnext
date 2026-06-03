import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Pencil, Printer, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FINANCE_EXCEL_TABLE_CLASS } from '../../lib/financeStyles';
import { formatPayrollMoney, PAYROLL_MONTH_LABELS, type PayrollSlipRow } from '../../lib/payrollTypes';
import {
  generatePayrollSlips,
  getOrCreatePayrollPeriod,
  importRhDataForSlip,
  listPayrollSlips,
  recomputeAllSlips,
  updatePayrollSlip,
} from '../../services/payrollApi';
import { downloadPayrollSlipsPdf, payrollSlipsPdfTitle } from '../../lib/payrollSlipPdf';

const EXCEL_CELL =
  'border border-border px-1.5 py-1 text-xs tabular-nums min-w-[4.5rem]';

type Props = {
  companyId: string;
  companyName: string;
};

export function PayrollSlipsPanel({ companyId, companyName }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [slips, setSlips] = useState<PayrollSlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editSlip, setEditSlip] = useState<PayrollSlipRow | null>(null);
  const [draft, setDraft] = useState<Partial<PayrollSlipRow>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const period = await getOrCreatePayrollPeriod(companyId, year, month);
    if (!period) {
      setSlips([]);
      setLoading(false);
      return;
    }
    const rows = await listPayrollSlips(period.id);
    setSlips(rows);
    setLoading(false);
  }, [companyId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      brut: slips.reduce((s, r) => s + r.salaire_brut, 0),
      cnss: slips.reduce((s, r) => s + r.cnss_salariale, 0),
      irpp: slips.reduce((s, r) => s + r.irpp, 0),
      net: slips.reduce((s, r) => s + r.net_a_payer, 0),
    }),
    [slips]
  );

  const handleGenerate = async () => {
    setBusy(true);
    const result = await generatePayrollSlips(companyId, year, month);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error || 'Génération impossible');
      return;
    }
    toast.success(`${result.count} fiche(s) générée(s)`);
    await load();
  };

  const handleRecalcAll = async () => {
    setBusy(true);
    const period = await getOrCreatePayrollPeriod(companyId, year, month);
    if (period) await recomputeAllSlips(period.id);
    setBusy(false);
    toast.success('Recalcul terminé');
    await load();
  };

  const openEdit = (slip: PayrollSlipRow) => {
    setEditSlip(slip);
    setDraft({ ...slip });
  };

  const saveEdit = async () => {
    if (!editSlip) return;
    setBusy(true);
    const result = await updatePayrollSlip(editSlip, draft);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error || 'Erreur');
      return;
    }
    setEditSlip(null);
    toast.success('Fiche mise à jour');
    await load();
  };

  const importRhForSlip = async () => {
    if (!editSlip) return;
    const rh = await importRhDataForSlip(editSlip.employee_id, year, month);
    setDraft((d) => ({
      ...d,
      avances: rh.avances,
      prets: rh.prets,
      penalites: rh.penalites,
      jours_conge: rh.jours_conge,
    }));
    toast.success('Données RH importées');
  };

  const pdfTitle = payrollSlipsPdfTitle(year, month, companyName);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Année</Label>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </div>
        <div>
          <Label className="text-xs">Mois</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYROLL_MONTH_LABELS.map((label, i) => (
                <SelectItem key={label} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Générer les fiches
        </Button>
        <Button variant="outline" onClick={handleRecalcAll} disabled={busy || slips.length === 0} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Recalculer
        </Button>
        <Button
          variant="outline"
          disabled={slips.length === 0}
          className="gap-2"
          onClick={() => downloadPayrollSlipsPdf(slips, pdfTitle)}
        >
          <Download className="w-4 h-4" />
          PDF
        </Button>
        <Button
          variant="outline"
          disabled={slips.length === 0}
          className="gap-2"
          onClick={() => {
            downloadPayrollSlipsPdf(slips, pdfTitle);
            toast.info('Utilisez « Enregistrer au format PDF » dans la fenêtre d\'impression si besoin.');
          }}
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-md border px-2 py-1">
          Total brut : <strong>{formatPayrollMoney(totals.brut)}</strong>
        </span>
        <span className="rounded-md border px-2 py-1">
          Total CNSS sal. : <strong>{formatPayrollMoney(totals.cnss)}</strong>
        </span>
        <span className="rounded-md border px-2 py-1">
          Total IRPP : <strong>{formatPayrollMoney(totals.irpp)}</strong>
        </span>
        <span className="rounded-md border px-2 py-1">
          Total net à payer : <strong>{formatPayrollMoney(totals.net)}</strong>
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Aucune fiche pour cette période. Assignez des employés à la société (RH → Employées, société) puis
          cliquez « Générer les fiches ».
        </p>
      ) : (
        <div className={`overflow-x-auto rounded-lg border ${FINANCE_EXCEL_TABLE_CLASS}`}>
          <table className="w-full border-collapse min-w-[2400px]">
            <thead>
              <tr className="bg-muted/60 text-xs">
                <th className={EXCEL_CELL}>Mois</th>
                <th className={EXCEL_CELL}>Matricule CNSS</th>
                <th className={EXCEL_CELL}>Nom</th>
                <th className={EXCEL_CELL}>Prénom</th>
                <th className={EXCEL_CELL}>S.B / TxH</th>
                <th className={EXCEL_CELL}>J/HT</th>
                <th className={EXCEL_CELL}>Nb.H</th>
                <th className={EXCEL_CELL}>Nb.H.supp</th>
                <th className={EXCEL_CELL}>J. congé</th>
                <th className={EXCEL_CELL}>J. férié</th>
                <th className={`${EXCEL_CELL} font-semibold`}>Salaire base</th>
                <th className={EXCEL_CELL}>Primes</th>
                <th className={`${EXCEL_CELL} font-semibold`}>Sal. brut</th>
                <th className={`${EXCEL_CELL} font-semibold`}>CNSS</th>
                <th className={EXCEL_CELL}>Sal. imposable</th>
                <th className={`${EXCEL_CELL} font-semibold`}>IRPP</th>
                <th className={`${EXCEL_CELL} font-semibold`}>CSS</th>
                <th className={EXCEL_CELL}>Sal. net</th>
                <th className={EXCEL_CELL}>Avance</th>
                <th className={EXCEL_CELL}>Prêts</th>
                <th className={EXCEL_CELL}>Pénalités</th>
                <th className={`${EXCEL_CELL} font-semibold`}>Net à payer</th>
                <th className={EXCEL_CELL} />
              </tr>
            </thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className={EXCEL_CELL}>{PAYROLL_MONTH_LABELS[month - 1]}</td>
                  <td className={EXCEL_CELL}>{s.matricule_cnss}</td>
                  <td className={EXCEL_CELL}>{s.employee?.nom}</td>
                  <td className={EXCEL_CELL}>{s.employee?.prenom}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.taux_horaire)}</td>
                  <td className={EXCEL_CELL}>{s.jours_ht}</td>
                  <td className={EXCEL_CELL}>{s.nb_heures}</td>
                  <td className={EXCEL_CELL}>{s.nb_heures_supp}</td>
                  <td className={EXCEL_CELL}>{s.jours_conge}</td>
                  <td className={EXCEL_CELL}>{s.jours_ferie}</td>
                  <td className={`${EXCEL_CELL} font-medium`}>{formatPayrollMoney(s.salaire_base)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.primes)}</td>
                  <td className={`${EXCEL_CELL} font-medium`}>{formatPayrollMoney(s.salaire_brut)}</td>
                  <td className={`${EXCEL_CELL} font-medium`}>{formatPayrollMoney(s.cnss_salariale)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.salaire_imposable)}</td>
                  <td className={`${EXCEL_CELL} font-medium`}>{formatPayrollMoney(s.irpp)}</td>
                  <td className={`${EXCEL_CELL} font-medium`}>{formatPayrollMoney(s.css)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.salaire_net)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.avances)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.prets)}</td>
                  <td className={EXCEL_CELL}>{formatPayrollMoney(s.penalites)}</td>
                  <td className={`${EXCEL_CELL} font-semibold`}>{formatPayrollMoney(s.net_a_payer)}</td>
                  <td className={EXCEL_CELL}>
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editSlip} onOpenChange={(o) => !o && setEditSlip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Fiche — {editSlip?.employee?.nom} {editSlip?.employee?.prenom}
            </DialogTitle>
          </DialogHeader>
          {editSlip && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label>Taux horaire</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draft.taux_horaire ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, taux_horaire: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Nb. heures</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.nb_heures ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, nb_heures: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>J/HT</Label>
                <Input
                  type="number"
                  value={draft.jours_ht ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, jours_ht: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Heures supp.</Label>
                <Input
                  type="number"
                  value={draft.nb_heures_supp ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, nb_heures_supp: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Jours congé</Label>
                <Input
                  type="number"
                  value={draft.jours_conge ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, jours_conge: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Jours férié</Label>
                <Input
                  type="number"
                  value={draft.jours_ferie ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, jours_ferie: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Primes</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draft.primes ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, primes: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Avances</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draft.avances ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, avances: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Prêts</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draft.prets ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, prets: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Pénalités</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draft.penalites ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, penalites: Number(e.target.value) }))}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={importRhForSlip}>
              Importer RH
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditSlip(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={saveEdit} disabled={busy}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

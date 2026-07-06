import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { Loader2, Plus, Printer, Download, MinusCircle } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import {
  HrEmployee,
  HrPayrollMovement,
  HrPayrollMovementType,
  formatHrMoney,
} from '@/lib/hrTypes';
import { downloadPayrollPdf, printPayrollPdf } from '@/utils/hrPayrollPdf';

type PayrollRow = {
  employee: HrEmployee;
  totalAvances: number;
  totalPenalites: number;
  totalPrets: number;
  netApres: number;
};

export const HrPayrollPanel = () => {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [movements, setMovements] = useState<HrPayrollMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    movement_type: 'avance' as HrPayrollMovementType,
    amount: '',
    movement_date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, movRes] = await Promise.all([
      supabase.from('hr_employees').select('*').order('nom'),
      supabase
        .from('hr_payroll_movements')
        .select('*, employee:hr_employees(prenom, nom)')
        .order('movement_date', { ascending: false }),
    ]);
    if (empRes.error || movRes.error) {
      toast.error('Erreur chargement paie');
    } else {
      setEmployees((empRes.data || []) as HrEmployee[]);
      setMovements((movRes.data || []) as HrPayrollMovement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payrollRows = useMemo((): PayrollRow[] => {
    return employees.map((employee) => {
      const empMoves = movements.filter((m) => m.employee_id === employee.id);
      const totalAvances = empMoves
        .filter((m) => m.movement_type === 'avance')
        .reduce((s, m) => s + Number(m.amount), 0);
      const totalPenalites = empMoves
        .filter((m) => m.movement_type === 'penalite')
        .reduce((s, m) => s + Number(m.amount), 0);
      const totalPrets = empMoves
        .filter((m) => m.movement_type === 'pret')
        .reduce((s, m) => s + Number(m.amount), 0);
      const netApres = Number(employee.salaire_net) - totalAvances - totalPenalites - totalPrets;
      return { employee, totalAvances, totalPenalites, totalPrets, netApres };
    });
  }, [employees, movements]);

  const totalAvances = payrollRows.reduce((s, r) => s + r.totalAvances, 0);
  const totalPenalites = payrollRows.reduce((s, r) => s + r.totalPenalites, 0);

  const openMovementDialog = (employeeId?: string, type?: HrPayrollMovementType) => {
    setForm({
      employee_id: employeeId || '',
      movement_type: type || 'avance',
      amount: '',
      movement_date: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setDialogOpen(true);
  };

  const handleSubmitMovement = async () => {
    if (!form.employee_id || !form.amount || !form.movement_date) {
      toast.error('Champs obligatoires manquants');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('hr_payroll_movements').insert({
      employee_id: form.employee_id,
      movement_type: form.movement_type,
      amount,
      movement_date: form.movement_date,
      note: form.note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Erreur enregistrement');
      return;
    }
    const labels: Record<HrPayrollMovementType, string> = {
      avance: 'Avance enregistrée',
      penalite: 'Pénalité enregistrée',
      pret: 'Prêt enregistré',
    };
    toast.success(labels[form.movement_type]);
    setDialogOpen(false);
    await load();
  };

  const pdfParams = useMemo(
    () => ({
      rows: payrollRows,
      totalAvances,
      totalPenalites,
    }),
    [payrollRows, totalAvances, totalPenalites]
  );

  const excelTable =
    'w-full border-collapse text-sm [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2 [&_tfoot_td]:font-semibold [&_tfoot_td]:bg-muted/40';

  return (
    <div className="space-y-4" id="hr-payroll-print-area">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            Total avances : <strong className="tabular-nums">-{formatHrMoney(totalAvances)}</strong>
          </span>
          <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
            Total pénalités : <strong className="tabular-nums">-{formatHrMoney(totalPenalites)}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" className="gap-2" onClick={() => openMovementDialog()}>
            <Plus className="w-4 h-4" />
            Avance / pénalité
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => printPayrollPdf(pdfParams)}
            disabled={payrollRows.length === 0}
          >
            <Printer className="w-4 h-4" />
            Imprimer PDF
          </Button>
          <Button
            className="gap-2"
            onClick={() => downloadPayrollPdf(pdfParams)}
            disabled={payrollRows.length === 0}
          >
            <Download className="w-4 h-4" />
            Télécharger PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
          Ajoutez des employés dans l&apos;onglet Employées.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className={excelTable}>
            <thead>
              <tr>
                <th className="w-10 text-center">N°</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th className="text-right">Salaire net</th>
                <th className="text-right">Total avances</th>
                <th className="text-right">Total pénalités</th>
                <th className="text-right">Net à payer</th>
                <th className="text-center w-36 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollRows.map((row, idx) => (
                <tr key={row.employee.id} className="hover:bg-muted/20">
                  <td className="text-center">{idx + 1}</td>
                  <td className="font-medium">{row.employee.nom}</td>
                  <td>{row.employee.prenom}</td>
                  <td className="text-right tabular-nums">{formatHrMoney(row.employee.salaire_net)}</td>
                  <td className="text-right tabular-nums text-amber-700">
                    {row.totalAvances > 0 ? `-${formatHrMoney(row.totalAvances)}` : '—'}
                  </td>
                  <td className="text-right tabular-nums text-rose-700">
                    {row.totalPenalites > 0 ? `-${formatHrMoney(row.totalPenalites)}` : '—'}
                  </td>
                  <td className="text-right tabular-nums font-semibold">{formatHrMoney(row.netApres)}</td>
                  <td className="print:hidden">
                    <div className="flex justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => openMovementDialog(row.employee.id, 'avance')}
                      >
                        Avance
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-600"
                        onClick={() => openMovementDialog(row.employee.id, 'penalite')}
                      >
                        Pénalité
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => openMovementDialog(row.employee.id, 'pret')}
                      >
                        Prêt
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-bold">
                  TOTAUX
                </td>
                <td className="text-right tabular-nums">
                  {formatHrMoney(payrollRows.reduce((s, r) => s + r.employee.salaire_net, 0))}
                </td>
                <td className="text-right tabular-nums text-amber-700">
                  -{formatHrMoney(totalAvances)}
                </td>
                <td className="text-right tabular-nums text-rose-700">
                  -{formatHrMoney(totalPenalites)}
                </td>
                <td className="text-right tabular-nums">
                  {formatHrMoney(payrollRows.reduce((s, r) => s + r.netApres, 0))}
                </td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {movements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MinusCircle className="w-4 h-4" />
            Historique des mouvements
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border max-h-48 overflow-y-auto">
            <table className={excelTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employé</th>
                  <th>Type</th>
                  <th className="text-right">Montant</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 50).map((m) => (
                  <tr key={m.id}>
                    <td>{formatAppDate(m.movement_date)}</td>
                    <td>
                      {m.employee?.nom} {m.employee?.prenom}
                    </td>
                    <td>
                      {m.movement_type === 'avance'
                        ? 'Avance'
                        : m.movement_type === 'pret'
                          ? 'Prêt'
                          : 'Pénalité'}
                    </td>
                    <td className="text-right tabular-nums text-rose-700">
                      -{formatHrMoney(m.amount)}
                    </td>
                    <td className="truncate max-w-[160px]">{m.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.movement_type === 'avance'
                ? 'Avance sur salaire'
                : form.movement_type === 'pret'
                  ? 'Prêt'
                  : 'Pénalité'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Employé *</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom} {e.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type *</Label>
              <Select
                value={form.movement_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, movement_type: v as HrPayrollMovementType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avance">Avance sur salaire (−)</SelectItem>
                  <SelectItem value="pret">Prêt (−)</SelectItem>
                  <SelectItem value="penalite">Pénalité (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Montant (TND) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.movement_date}
                  onChange={(e) => setForm((f) => ({ ...f, movement_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitMovement} disabled={submitting}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

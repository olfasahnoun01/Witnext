import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { HrEmployee, HrEmployeeLeave } from '@/lib/hrTypes';

export const HrLeavesPanel = () => {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leaves, setLeaves] = useState<HrEmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    date_from: '',
    date_to: '',
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('hr_employees').select('id, prenom, nom').order('nom'),
      supabase
        .from('hr_employee_leaves')
        .select('*, employee:hr_employees(prenom, nom)')
        .order('date_from', { ascending: false }),
    ]);
    if (empRes.error || leaveRes.error) {
      toast.error('Erreur chargement congés');
    } else {
      setEmployees((empRes.data || []) as HrEmployee[]);
      setLeaves((leaveRes.data || []) as HrEmployeeLeave[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!form.employee_id || !form.date_from || !form.date_to) {
      toast.error('Employé et dates requis');
      return;
    }
    if (form.date_to < form.date_from) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('hr_employee_leaves').insert({
      employee_id: form.employee_id,
      date_from: form.date_from,
      date_to: form.date_to,
      note: form.note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Erreur enregistrement congé');
      return;
    }
    toast.success('Congé enregistré');
    setDialogOpen(false);
    setForm({ employee_id: '', date_from: '', date_to: '', note: '' });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce congé ?')) return;
    const { error } = await supabase.from('hr_employee_leaves').delete().eq('id', id);
    if (error) {
      toast.error('Erreur suppression');
      return;
    }
    await load();
  };

  const excelTable =
    'w-full border-collapse text-sm [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2"
          disabled={employees.length === 0}
        >
          <Plus className="w-4 h-4" />
          Ajouter un congé
        </Button>
      </div>

      {employees.length === 0 && !loading && (
        <p className="text-sm text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          Enregistrez d&apos;abord des employés dans l&apos;onglet Employées.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
          Aucun congé enregistré.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={excelTable}>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Du</th>
                <th>Au</th>
                <th>Note</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id}>
                  <td className="font-medium">
                    {leave.employee?.nom} {leave.employee?.prenom}
                  </td>
                  <td>{new Date(`${leave.date_from}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                  <td>{new Date(`${leave.date_to}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                  <td className="max-w-xs truncate">{leave.note || '—'}</td>
                  <td>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(leave.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="w-5 h-5" />
              Nouveau congé
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Employé *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un employé" />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date début *</Label>
                <Input
                  type="date"
                  value={form.date_from}
                  onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date fin *</Label>
                <Input
                  type="date"
                  value={form.date_to}
                  onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

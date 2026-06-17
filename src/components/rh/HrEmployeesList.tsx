import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, FileText, ExternalLink } from 'lucide-react';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { HrEmployee, formatHrMoney } from '@/lib/hrTypes';
import { validateUploadFile } from '@/lib/uploadValidation';
import { buildCompanyStoragePath } from '@/lib/storagePaths';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emptyForm = () => ({
  prenom: '',
  nom: '',
  cin: '',
  matricule_cnss: '',
  taux_horaire: '',
  company_id: '',
  phone1: '',
  phone2: '',
  adresse: '',
  salaire_net: '',
  contractFile: null as File | null,
});

export const HrEmployeesList = () => {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      setCompanies(data || []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    let q = supabase.from('hr_employees').select('*');
    if (cid) q = q.eq('company_id' as any, cid);
    const { data, error } = await q.order('nom', { ascending: true });
    if (error) {
      toast.error('Erreur chargement employés');
      console.error(error);
    } else {
      setEmployees((data || []) as HrEmployee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useCompanyChangeReload(load);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (emp: HrEmployee) => {
    setEditing(emp);
    setForm({
      prenom: emp.prenom,
      nom: emp.nom,
      cin: emp.cin || '',
      matricule_cnss: emp.matricule_cnss || '',
      taux_horaire: emp.taux_horaire ? String(emp.taux_horaire) : '',
      company_id: emp.company_id || '',
      phone1: emp.phone1 || '',
      phone2: emp.phone2 || '',
      adresse: emp.adresse || '',
      salaire_net: emp.salaire_net ? String(emp.salaire_net) : '',
      contractFile: null,
    });
    setDialogOpen(true);
  };

  const uploadContract = async (employeeId: string, file: File): Promise<string | null> => {
    const check = validateUploadFile(file, [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    if (!check.ok) {
      toast.error(check.message);
      return null;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = buildCompanyStoragePath(`${employeeId}/${Date.now()}-${safe}`);
    const { error } = await supabase.storage.from('hr-contracts').upload(path, file, { upsert: true });
    if (error) {
      toast.error('Erreur upload contrat');
      return null;
    }
    return path;
  };

  const handleSubmit = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error('Nom et prénom requis');
      return;
    }
    if (!form.matricule_cnss.trim()) {
      toast.error('Matricule CNSS obligatoire');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        cin: form.cin.trim() || null,
        matricule_cnss: form.matricule_cnss.trim(),
        taux_horaire: form.taux_horaire ? Number(form.taux_horaire) : 0,
        company_id: form.company_id || null,
        phone1: form.phone1.trim() || null,
        phone2: form.phone2.trim() || null,
        adresse: form.adresse.trim() || null,
        salaire_net: form.salaire_net ? Number(form.salaire_net) : 0,
      };

      let employeeId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('hr_employees').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('hr_employees').insert(payload).select('id').single();
        if (error) throw error;
        employeeId = data?.id;
      }

      if (employeeId && form.contractFile) {
        const path = await uploadContract(employeeId, form.contractFile);
        if (path) {
          await supabase.from('hr_employees').update({ contract_url: path }).eq('id', employeeId);
        }
      }

      toast.success(editing ? 'Employé mis à jour' : 'Employé ajouté');
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Erreur enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cet employé et ses congés / mouvements associés ?')) return;
    const { error } = await supabase.from('hr_employees').delete().eq('id', id);
    if (error) {
      toast.error('Erreur suppression');
      return;
    }
    toast.success('Employé supprimé');
    await load();
  };

  const openContract = async (path: string) => {
    const { data, error } = await supabase.storage.from('hr-contracts').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Impossible d\'ouvrir le contrat');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const excelTable =
    'w-full border-collapse text-sm [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un employé
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-lg">
          Aucun employé enregistré.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={excelTable}>
            <thead>
              <tr>
                <th className="text-left w-10">N°</th>
                <th className="text-left">Nom</th>
                <th className="text-left">Prénom</th>
                <th className="text-left">Matricule CNSS</th>
                <th className="text-left">CIN</th>
                <th className="text-left">Société</th>
                <th className="text-left">Tél. 1</th>
                <th className="text-left">Tél. 2</th>
                <th className="text-left">Adresse</th>
                <th className="text-right">Salaire net</th>
                <th className="text-center">Contrat</th>
                <th className="text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td>{idx + 1}</td>
                  <td className="font-medium">{emp.nom}</td>
                  <td>{emp.prenom}</td>
                  <td className="font-mono text-xs">{emp.matricule_cnss}</td>
                  <td>{emp.cin || '—'}</td>
                  <td className="text-xs">
                    {companies.find((c) => c.id === emp.company_id)?.name || '—'}
                  </td>
                  <td>{emp.phone1 || '—'}</td>
                  <td>{emp.phone2 || '—'}</td>
                  <td className="max-w-[200px] truncate" title={emp.adresse || ''}>
                    {emp.adresse || '—'}
                  </td>
                  <td className="text-right tabular-nums">{formatHrMoney(emp.salaire_net)}</td>
                  <td className="text-center">
                    {emp.contract_url ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => openContract(emp.contract_url!)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'employé' : 'Nouvel employé'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom *</Label>
                <Input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Matricule CNSS *</Label>
              <Input
                value={form.matricule_cnss}
                onChange={(e) => setForm((f) => ({ ...f, matricule_cnss: e.target.value }))}
                placeholder="Numéro CNSS"
              />
            </div>
            <div>
              <Label>N° CIN</Label>
              <Input value={form.cin} onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))} />
            </div>
            <div>
              <Label>Société (Finance)</Label>
              <Select
                value={form.company_id || '_none'}
                onValueChange={(v) => setForm((f) => ({ ...f, company_id: v === '_none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une société" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Non assigné —</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Taux horaire (TND)</Label>
              <Input
                type="number"
                step="0.001"
                value={form.taux_horaire}
                onChange={(e) => setForm((f) => ({ ...f, taux_horaire: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Téléphone 1</Label>
                <Input value={form.phone1} onChange={(e) => setForm((f) => ({ ...f, phone1: e.target.value }))} />
              </div>
              <div>
                <Label>Téléphone 2</Label>
                <Input value={form.phone2} onChange={(e) => setForm((f) => ({ ...f, phone2: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Adresse</Label>
              <Textarea
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <Label>Salaire net (TND)</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.salaire_net}
                onChange={(e) => setForm((f) => ({ ...f, salaire_net: e.target.value }))}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Contrat (PDF ou image)
              </Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) =>
                  setForm((f) => ({ ...f, contractFile: e.target.files?.[0] ?? null }))
                }
              />
              {editing?.contract_url && !form.contractFile && (
                <p className="text-xs text-muted-foreground mt-1">Un contrat est déjà enregistré.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

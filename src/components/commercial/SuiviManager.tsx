import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, FileText, Download, ChevronDown, FileSpreadsheet, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportSuiviPartiesExcel, exportSuiviPartiesPdf } from '@/lib/exportSuiviParties';
import { supabase } from '@/integrations/supabase/client';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { ensureSupabaseSessionReady, supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { formatError } from '@/lib/formatError';
import { buildProfilesMap, collectUserIdsForProfiles, formatModifieePar, attachProfileNames } from '@/lib/documentListAudit';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SuiviRow {
  id: number;
  devis_date: string | null;
  devis_number: string | null;
  societe: string;
  telephone: string | null;
  reponse: string | null;
  dernier_contact_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  suivi_par_name: string | null;
  modifier_name: string | null;
}

interface SuiviFormState {
  devis_date: string;
  devis_number: string;
  societe: string;
  telephone: string;
  reponse: string;
  dernier_contact_date: string;
}

const EMPTY_FORM: SuiviFormState = {
  devis_date: '',
  devis_number: '',
  societe: '',
  telephone: '',
  reponse: '',
  dernier_contact_date: '',
};

function formatDisplayDate(value: string | null): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return value;
  }
}

interface SuiviManagerProps {
  type: 'client' | 'fournisseur';
}

export const SuiviManager = ({ type }: SuiviManagerProps) => {
  const [rows, setRows] = useState<SuiviRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SuiviFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const resetDialog = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  const loadSuivi = useCallback(async () => {
    setLoading(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) {
        notifySessionInvalid();
        return;
      }
      const companyId = getActiveCompanyId();
      const { data, error } = await supabaseQueryWithAuthRetry(() => {
        let q = supabase
          .from('parties_suivi')
          .select('id, devis_date, devis_number, societe, telephone, reponse, dernier_contact_date, created_by, updated_by')
          .eq('party_type', type);
        if (companyId) q = q.eq('company_id', companyId);
        return q.order('created_at', { ascending: false });
      });
      if (error) throw error;

      const rawRows = (data ?? []) as Array<Omit<SuiviRow, 'suivi_par_name' | 'modifier_name'>>;
      const userIds = collectUserIdsForProfiles(rawRows);
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        if (profilesError) throw profilesError;
        profilesMap = buildProfilesMap(profiles ?? []);
      }

      setRows(
        rawRows.map((row) => {
          const withNames = attachProfileNames(row, profilesMap);
          return {
            ...withNames,
            suivi_par_name: withNames.creator_name,
          };
        })
      );
    } catch (err) {
      console.error(err);
      toast.error(`Erreur chargement suivi : ${formatError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useCompanyChangeReload(loadSuivi);
  useSessionResumeReload(loadSuivi);

  useEffect(() => {
    void loadSuivi();
  }, [loadSuivi]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.societe, row.devis_number, row.telephone, row.reponse, row.suivi_par_name, row.modifier_name]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  const openCreate = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = (row: SuiviRow) => {
    setEditingId(row.id);
    setForm({
      devis_date: row.devis_date ?? '',
      devis_number: row.devis_number ?? '',
      societe: row.societe,
      telephone: row.telephone ?? '',
      reponse: row.reponse ?? '',
      dernier_contact_date: row.dernier_contact_date ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.societe.trim()) {
      toast.error('La société est obligatoire');
      return;
    }
    const companyId = getActiveCompanyId();
    if (!companyId) {
      toast.error('Société active introuvable');
      return;
    }

    setSaving(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) {
        notifySessionInvalid();
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        company_id: companyId,
        party_type: type,
        devis_date: form.devis_date || null,
        devis_number: form.devis_number.trim() || null,
        societe: form.societe.trim(),
        telephone: form.telephone.trim() || null,
        reponse: form.reponse.trim() || null,
        dernier_contact_date: form.dernier_contact_date || null,
        ...(editingId ? {} : { created_by: user?.id ?? null }),
      };

      if (editingId) {
        const { error } = await supabase
          .from('parties_suivi')
          .update({
            ...payload,
            updated_by: user?.id ?? null,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Ligne mise à jour');
      } else {
        const { error } = await supabase.from('parties_suivi').insert(payload);
        if (error) throw error;
        toast.success('Ligne ajoutée');
      }

      setDialogOpen(false);
      resetDialog();
      await loadSuivi();
    } catch (err) {
      console.error(err);
      toast.error(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer cette ligne de suivi ?')) return;
    try {
      const { error } = await supabase.from('parties_suivi').delete().eq('id', id);
      if (error) throw error;
      toast.success('Ligne supprimée');
      await loadSuivi();
    } catch (err) {
      console.error(err);
      toast.error(formatError(err));
    }
  };

  const partyLabel = type === 'client' ? 'client' : 'fournisseur';

  const handleExport = useCallback(
    async (format: 'excel' | 'pdf') => {
      if (filteredRows.length === 0) {
        toast.error('Aucune ligne à exporter');
        return;
      }
      setExporting(true);
      try {
        if (format === 'excel') {
          await exportSuiviPartiesExcel(type, filteredRows);
          toast.success('Liste exportée en Excel');
        } else {
          await exportSuiviPartiesPdf(type, filteredRows);
          toast.success('Liste exportée en PDF');
        }
      } catch (err) {
        console.error(err);
        toast.error(format === 'excel' ? 'Erreur export Excel' : 'Erreur export PDF');
      } finally {
        setExporting(false);
      }
    },
    [filteredRows, type]
  );

  return (
    <Card className="overflow-hidden border-2 shadow-sm">
      <CardHeader
        className={cn(
          'border-b pb-4',
          type === 'client'
            ? 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent'
            : 'bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent'
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className={cn('w-5 h-5', type === 'client' ? 'text-emerald-600' : 'text-orange-600')} />
            <span>Suivi {type === 'client' ? 'clients' : 'fournisseurs'}</span>
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full border',
                type === 'client'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200'
              )}
            >
              {type === 'client' ? 'Clients' : 'Fournisseurs'}
            </span>
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 shrink-0" disabled={exporting || loading}>
                  <Download className="w-4 h-4" />
                  Exporter
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => void handleExport('excel')}
                  disabled={exporting}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => void handleExport('pdf')}
                  disabled={exporting}
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="gap-2 shrink-0" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Ajouter une ligne
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold">Date devis</TableHead>
                <TableHead className="font-semibold">N° Devis</TableHead>
                <TableHead className="font-semibold">Société</TableHead>
                <TableHead className="font-semibold">Téléphone</TableHead>
                <TableHead className="font-semibold min-w-[360px] w-[40%]">Réponse / Description</TableHead>
                <TableHead className="font-semibold">Date dernier contact</TableHead>
                <TableHead className="font-semibold min-w-[140px]">Suivi par</TableHead>
                <TableHead className="font-semibold min-w-[140px]">Modifié par</TableHead>
                <TableHead className="w-[90px] text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground italic">
                    Aucune ligne — saisissez le suivi manuellement pour chaque {partyLabel}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'align-top hover:bg-muted/40',
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/15'
                    )}
                  >
                    <TableCell className="text-sm whitespace-nowrap py-3">
                      {formatDisplayDate(row.devis_date)}
                    </TableCell>
                    <TableCell className="text-sm font-mono py-3">{row.devis_number || '—'}</TableCell>
                    <TableCell className="text-sm font-semibold py-3">{row.societe}</TableCell>
                    <TableCell className="text-sm py-3">{row.telephone || '—'}</TableCell>
                    <TableCell className="py-3 min-w-[360px]">
                      <div
                        className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground max-h-40 overflow-y-auto rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                        title={row.reponse ?? undefined}
                      >
                        {row.reponse || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap py-3">
                      {formatDisplayDate(row.dernier_contact_date)}
                    </TableCell>
                    <TableCell className="text-sm py-3">
                      <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium">
                        {row.suivi_par_name ? `Suivi par : ${row.suivi_par_name}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm py-3">
                      {formatModifieePar(row) !== '-' ? (
                        <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                          {formatModifieePar(row)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void handleDelete(row.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier la ligne' : 'Nouvelle ligne de suivi'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="societe">Société *</Label>
              <Input
                id="societe"
                value={form.societe}
                onChange={(e) => setForm({ ...form, societe: e.target.value })}
                placeholder={`Nom du ${partyLabel}`}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="devis_date">Date devis</Label>
                <Input
                  id="devis_date"
                  type="date"
                  value={form.devis_date}
                  onChange={(e) => setForm({ ...form, devis_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="devis_number">N° Devis</Label>
                <Input
                  id="devis_number"
                  value={form.devis_number}
                  onChange={(e) => setForm({ ...form, devis_number: e.target.value })}
                  placeholder="Ex: DEV-01"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                placeholder="+216 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reponse">Réponse / Description</Label>
              <Textarea
                id="reponse"
                value={form.reponse}
                onChange={(e) => setForm({ ...form, reponse: e.target.value })}
                placeholder="Réponse du client / fournisseur — texte libre, description complète"
                className="min-h-[180px] text-base leading-relaxed resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dernier_contact_date">Date dernier contact</Label>
              <Input
                id="dernier_contact_date"
                type="date"
                value={form.dernier_contact_date}
                onChange={(e) => setForm({ ...form, dernier_contact_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetDialog();
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

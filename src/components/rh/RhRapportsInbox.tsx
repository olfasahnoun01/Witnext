import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Inbox,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatAppDate, formatAppDateTime } from '@/lib/formatAppDate';
import {
  incidentTypeLabels,
  RH_REPORT_KINDS,
  rhReportRecordToForm,
  type RhSecurityReportRecord,
} from '@/lib/rhReportTypes';
import {
  deleteRhSecurityReport,
  fetchRhSecurityReports,
  getRhReportAttachmentUrl,
} from '@/services/rhReportService';
import { downloadRhSecurityReportPdf } from '@/utils/rhSecurityReportPdf';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useAuth } from '@/hooks/useAuth';

export function RhRapportsInbox() {
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();
  const [reports, setReports] = useState<RhSecurityReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RhSecurityReportRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RhSecurityReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const canDelete = isAdmin || isModerator;

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchRhSecurityReports();
      setReports(rows);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Chargement impossible',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useSessionResumeReload(loadReports);
  useCompanyChangeReload(loadReports);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const kind = RH_REPORT_KINDS.find((k) => k.id === r.report_kind)?.label ?? r.report_kind;
      return [
        r.title,
        r.company_name,
        r.location,
        r.author_name,
        kind,
        incidentTypeLabels(r.incident_types),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [reports, search]);

  const handleDownloadPdf = async (record: RhSecurityReportRecord) => {
    setExportingId(record.id);
    try {
      await downloadRhSecurityReportPdf(
        rhReportRecordToForm(record),
        `rapport_${record.id.slice(0, 8)}.pdf`
      );
      toast({ title: 'PDF téléchargé' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur PDF',
        description: err instanceof Error ? err.message : 'Génération impossible',
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    const url = await getRhReportAttachmentUrl(path);
    if (!url) {
      toast({ variant: 'destructive', title: 'Pièce jointe inaccessible' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRhSecurityReport(deleteTarget.id);
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      toast({ title: 'Rapport supprimé' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Suppression impossible',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un rapport…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des rapports…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Inbox className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="font-medium">Aucun rapport reçu</p>
          <p className="text-sm mt-1">
            Les rapports RH enregistrés depuis ce module apparaîtront ici.
            Les rapports de visite chauffeurs (app mobile) sont dans l&apos;onglet « Visites chauffeurs ».
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Reçu le</th>
                <th className="px-4 py-3 font-semibold">Expéditeur</th>
                <th className="px-4 py-3 font-semibold">Titre</th>
                <th className="px-4 py-3 font-semibold">Société / site</th>
                <th className="px-4 py-3 font-semibold">Nature</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => {
                const kindLabel =
                  RH_REPORT_KINDS.find((k) => k.id === report.report_kind)?.label ?? report.report_kind;
                return (
                  <tr key={report.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatAppDateTime(report.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{report.author_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{report.title}</div>
                      <div className="text-xs text-muted-foreground">{kindLabel}</div>
                    </td>
                    <td className="px-4 py-3">
                      {report.company_name || '—'}
                      {report.incident_date ? (
                        <div className="text-xs text-muted-foreground">
                          Incident : {formatAppDate(report.incident_date)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {report.incident_types.slice(0, 2).map((id) => (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {incidentTypeLabels([id])}
                          </Badge>
                        ))}
                        {report.incident_types.length > 2 ? (
                          <Badge variant="outline" className="text-xs">
                            +{report.incident_types.length - 2}
                          </Badge>
                        ) : null}
                        {report.attachment_paths.length > 0 ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Paperclip className="h-3 w-3" />
                            {report.attachment_paths.length}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelected(report)} title="Détail">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPdf(report)}
                          disabled={exportingId === report.id}
                          title="PDF"
                        >
                          {exportingId === report.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(report)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Expéditeur :</span>{' '}
                  <strong>{selected.author_name}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Reçu le :</span>{' '}
                  {formatAppDateTime(selected.created_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Société :</span> {selected.company_name || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Lieu :</span> {selected.location || '—'}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Nature :</span>{' '}
                  {incidentTypeLabels(selected.incident_types)}
                </p>
              </div>

              {selected.subtitle ? (
                <p className="text-muted-foreground italic">{selected.subtitle}</p>
              ) : null}

              <div className="space-y-3">
                {selected.body_sections.map((section, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <p className="font-semibold mb-1">{section.title}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{section.content || '—'}</p>
                  </div>
                ))}
              </div>

              {selected.vehicle_info ? (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-semibold">Véhicule</p>
                  <p>{selected.vehicle_info.immatriculation} — {selected.vehicle_info.marque_modele}</p>
                  <p>Conducteur : {selected.vehicle_info.conducteur || '—'}</p>
                  {selected.vehicle_info.description_degats ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selected.vehicle_info.description_degats}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selected.attachment_paths.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Pièces jointes
                  </p>
                  <ul className="space-y-1">
                    {selected.attachment_paths.map((path) => (
                      <li key={path}>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-sm"
                          onClick={() => handleOpenAttachment(path)}
                        >
                          {path.split('/').pop()}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button onClick={() => handleDownloadPdf(selected)} disabled={exportingId === selected.id}>
                {exportingId === selected.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger PDF
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le rapport « {deleteTarget?.title} » sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

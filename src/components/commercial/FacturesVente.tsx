import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileText, CheckCircle, Clock, XCircle, FileEdit, Trash2, Eye, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Facture } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteFactureVente } from '@/services/factureService';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';
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

const REFRESH_EVENT = 'grosafe:factures-refresh';

const toFacturePDFData = (facture: Facture): DevisPDFData => ({
  devis_number: facture.numero,
  devis_date: facture.date_creation,
  type: 'sortant',
  third_party_name: facture.third_party_name,
  third_party_address: facture.third_party_address,
  third_party_tax_id: facture.third_party_tax_id,
  third_party_phone: facture.third_party_phone,
  items: facture.items,
  total_amount: facture.total_amount,
  notes: facture.notes,
  is_ttc: facture.is_ttc,
  is_bc: false,
  is_ba: false,
  is_facture: true,
  date_echeance: facture.date_echeance,
});

export const FacturesVente = () => {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [bcNumberById, setBcNumberById] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [busyFactureId, setBusyFactureId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Facture | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFactures = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('factures')
        .select('*')
        .eq('type', 'vente')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as Facture[];
      setFactures(rows);

      const blIds = [
        ...new Set(
          rows.flatMap((f) => {
            const ids: number[] = [];
            if (typeof f.source_bl_id === 'number') ids.push(f.source_bl_id);
            if (Array.isArray(f.source_bl_ids)) {
              for (const id of f.source_bl_ids) {
                if (typeof id === 'number') ids.push(id);
              }
            }
            if (ids.length === 0 && typeof f.source_bc_id === 'number') ids.push(f.source_bc_id);
            return ids;
          })
        ),
      ];
      if (blIds.length > 0) {
        const { data: bls } = await supabase.from('devis').select('id, devis_number').in('id', blIds);
        const map = new Map<number, string>();
        (bls || []).forEach((r: { id: number; devis_number: string }) => map.set(r.id, r.devis_number));
        setBcNumberById(map);
      } else {
        setBcNumberById(new Map());
      }
    } catch (err: unknown) {
      console.error('Error fetching factures:', err);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFactures();
  }, [fetchFactures]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchFactures();
    };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [fetchFactures]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  const handlePreview = useCallback(async (facture: Facture) => {
    setBusyFactureId(facture.id);
    try {
      const url = await getDevisPDFBlobUrl(toFacturePDFData(facture));
      setPreviewTitle(`Facture ${facture.numero}`);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Error generating facture preview:', err);
      toast.error('Impossible de générer l\'aperçu de la facture');
    } finally {
      setBusyFactureId(null);
    }
  }, []);

  const handleDownload = useCallback(async (facture: Facture) => {
    setBusyFactureId(facture.id);
    try {
      await downloadDevisPDF(toFacturePDFData(facture));
    } catch (err) {
      console.error('Error downloading facture PDF:', err);
      toast.error('Impossible de télécharger la facture');
    } finally {
      setBusyFactureId(null);
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const result = await deleteFactureVente(deleteConfirm.id);
      if (!result.success) {
        toast.error(result.error || 'Erreur lors de la suppression');
        return;
      }
      toast.success('Facture supprimée');
      setDeleteConfirm(null);
      await fetchFactures();
      window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, fetchFactures]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'payée':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20"><CheckCircle className="w-3.5 h-3.5" /> Payée</span>;
      case 'envoyée':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"><FileText className="w-3.5 h-3.5" /> Envoyée</span>;
      case 'retard':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20"><Clock className="w-3.5 h-3.5" /> En Retard</span>;
      case 'annulée':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"><XCircle className="w-3.5 h-3.5" /> Annulée</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border"><FileEdit className="w-3.5 h-3.5" /> Brouillon</span>;
    }
  };

  const filteredFactures = useMemo(
    () =>
      factures.filter(
        (f) =>
          f.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.third_party_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ((f.source_bl_id && (bcNumberById.get(f.source_bl_id) || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.source_bc_id && (bcNumberById.get(f.source_bc_id) || '').toLowerCase().includes(searchQuery.toLowerCase())))
      ),
    [factures, searchQuery, bcNumberById]
  );

  const {
    slice: facturesPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(filteredFactures, searchQuery);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Factures de Vente</h2>
        </div>

        <div className="relative flex-1 md:w-72 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="N° facture, client, N° BC…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">N° Facture</th>
                <th className="px-6 py-4 font-medium">BL source</th>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Échéance</th>
                <th className="px-6 py-4 font-medium text-right">Montant TTC</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    Chargement des factures...
                  </td>
                </tr>
              ) : filteredFactures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-muted-foreground/50" />
                      <p>Aucune facture trouvée</p>
                    </div>
                  </td>
                </tr>
              ) : (
                facturesPage.map((facture) => (
                  <tr key={facture.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {facture.numero}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {(() => {
                        const blId = facture.source_bl_id ?? facture.source_bc_id;
                        if (!blId) return '—';
                        return bcNumberById.get(blId) || `BL #${blId}`;
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {facture.third_party_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(facture.date_creation), 'dd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {facture.date_echeance ? format(new Date(facture.date_echeance), 'dd MMM yyyy', { locale: fr }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {facture.total_amount.toLocaleString('fr-TN', { style: 'currency', currency: 'TND' })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(facture.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10 disabled:opacity-50"
                          title="Aperçu PDF"
                          disabled={busyFactureId === facture.id}
                          onClick={() => void handlePreview(facture)}
                        >
                          {busyFactureId === facture.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10 disabled:opacity-50"
                          title="Télécharger PDF"
                          disabled={busyFactureId === facture.id}
                          onClick={() => void handleDownload(facture)}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 disabled:opacity-50"
                          title="Supprimer"
                          disabled={busyFactureId === facture.id || isDeleting}
                          onClick={() => setDeleteConfirm(facture)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              La facture <strong>{deleteConfirm?.numero}</strong> sera supprimée définitivement.
              {deleteConfirm?.source_bl_id && (
                <> Le bouton « Facture » redeviendra disponible sur le BL source.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle>{previewTitle}</DialogTitle>
            {previewUrl && (
              <a href={previewUrl} download={`${previewTitle}.pdf`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger
                </Button>
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                className="h-[75vh] w-full border rounded-lg bg-muted/30"
                title="Aperçu facture"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

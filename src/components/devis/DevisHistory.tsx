import { memo, useMemo, useState, useCallback } from 'react';
import { History, Edit, Trash2, Eye, Download, Loader2 } from 'lucide-react';
import { Devis } from '@/types';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DevisHistoryProps {
  savedDevis: Devis[];
  canEdit: boolean;
  onEdit: (d: Devis) => void;
  onDelete: (d: Devis) => void;
}

const ITEMS_PER_PAGE = 10;

const statusColors: Record<string, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  envoyé: 'bg-primary/10 text-primary',
  accepté: 'bg-success/10 text-success',
  refusé: 'bg-destructive/10 text-destructive',
};

const toDevisPDFData = (d: Devis): DevisPDFData => ({
  devis_number: d.devis_number,
  devis_date: d.devis_date,
  type: d.type,
  third_party_name: d.third_party_name,
  third_party_address: d.third_party_address,
  third_party_tax_id: d.third_party_tax_id,
  third_party_phone: d.third_party_phone,
  items: d.items,
  total_amount: d.total_amount,
  notes: d.notes,
});

export const DevisHistory = memo(({ savedDevis, canEdit, onEdit, onDelete }: DevisHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);

  const paginatedDevis = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return savedDevis.slice(start, start + ITEMS_PER_PAGE);
  }, [savedDevis, currentPage]);

  const totalPages = Math.ceil(savedDevis.length / ITEMS_PER_PAGE);

  const handlePreview = useCallback(async (d: Devis) => {
    setIsGenerating(d.id);
    try {
      const url = await getDevisPDFBlobUrl(toDevisPDFData(d));
      setPreviewTitle(`Devis ${d.devis_number}`);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Error generating preview:', err);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const handleDownload = useCallback(async (d: Devis) => {
    setIsGenerating(d.id);
    try {
      await downloadDevisPDF(toDevisPDFData(d));
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  if (savedDevis.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Historique des Devis</h3>
        <div className="text-center py-12">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Aucun devis dans l'historique.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Historique des Devis</h3>
          <span className="text-sm text-muted-foreground">{savedDevis.length} devis</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N°</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tiers</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">PDF</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevis.map(d => {
                const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
                const generating = isGenerating === d.id;
                return (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        d.type === 'entrant' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                      }`}>
                        {d.type === 'entrant' ? '📥 Entrant' : '📤 Sortant'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{d.devis_number}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(d.devis_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{d.third_party_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {d.items.length} articles ({totalQty} unités)
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {d.total_amount > 0 ? `${d.total_amount.toFixed(3)} TND` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusColors[d.status] || ''}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePreview(d)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Prévisualiser PDF"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDownload(d)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {canEdit && (
                          <>
                            <button onClick={() => onEdit(d)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Modifier">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(d)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
              Précédent
            </button>
            <span className="text-sm text-muted-foreground">Page {currentPage} sur {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
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
                src={previewUrl}
                className="w-full h-[75vh] border rounded-lg"
                title="Prévisualisation PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis <strong>{deleteConfirm?.devis_number}</strong> sera supprimé définitivement.
              <br /><br />
              ✅ <strong>Le stock ne sera pas affecté</strong> — les devis n'impactent jamais l'inventaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirm) { onDelete(deleteConfirm); setDeleteConfirm(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

DevisHistory.displayName = 'DevisHistory';

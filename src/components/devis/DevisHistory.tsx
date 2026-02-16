import { memo, useMemo, useState, useCallback } from 'react';
import { History, Edit, Trash2, Eye, Download, Loader2, Search, X, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  is_ttc: d.is_ttc,
});

export const DevisHistory = memo(({ savedDevis, canEdit, onEdit, onDelete }: DevisHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsDevis, setItemsDevis] = useState<Devis | null>(null);

  const filteredDevis = useMemo(() => {
    if (!searchTerm.trim()) return savedDevis;
    const term = searchTerm.toLowerCase().trim();
    return savedDevis.filter(d =>
      d.items.some(item =>
        item.designation.toLowerCase().includes(term) ||
        item.fournisseur?.toLowerCase().includes(term)
      )
    );
  }, [savedDevis, searchTerm]);

  const paginatedDevis = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDevis.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDevis, currentPage]);

  const totalPages = Math.ceil(filteredDevis.length / ITEMS_PER_PAGE);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h3 className="text-lg font-semibold text-foreground">Historique des Devis</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-8 h-9 w-56"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredDevis.length} devis</span>
          </div>
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
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Mode</th>
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
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setItemsDevis(d)}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Voir les articles"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {d.items.length} articles ({totalQty} unités)
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {d.total_amount > 0 ? `${d.total_amount.toFixed(3)} TND` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        d.is_ttc ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                      }`}>
                        {d.is_ttc ? 'TTC' : 'HT'}
                      </span>
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

      {/* Items Detail Dialog */}
      <Dialog open={!!itemsDevis} onOpenChange={() => setItemsDevis(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Articles du devis {itemsDevis?.devis_number}</DialogTitle>
          </DialogHeader>
          {itemsDevis && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Désignation</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fournisseur</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prix</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Remise</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qté</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsDevis.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 text-foreground font-medium">{item.designation}</td>
                      <td className="py-2 px-3 text-muted-foreground">{item.fournisseur || '-'}</td>
                      <td className="py-2 px-3 text-right text-foreground">{item.prix_ttc.toFixed(3)} TND</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{item.remise > 0 ? `${item.remise}%` : '-'}</td>
                      <td className="py-2 px-3 text-right text-foreground">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{(item.prix_ttc * item.quantity).toFixed(3)} TND</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={5} />
                    <td className="py-2 px-3 text-right font-semibold text-foreground">Total</td>
                    <td className="py-2 px-3 text-right font-semibold text-primary">{itemsDevis.total_amount.toFixed(3)} TND</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

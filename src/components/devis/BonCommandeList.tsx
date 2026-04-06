import { memo, useMemo, useState, useCallback } from 'react';
import { FileText, Trash2, Download, Eye, Loader2, Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BonCommande } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface BonCommandeListProps {
  bonsCommande: BonCommande[];
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onDelete: (bc: BonCommande) => void;
}

const ITEMS_PER_PAGE = 10;

export const BonCommandeList = memo(({ bonsCommande, currentUserId, isAdminOrMod, onDelete }: BonCommandeListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<BonCommande | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBC = useMemo(() => {
    if (!searchTerm.trim()) return bonsCommande;
    const term = searchTerm.toLowerCase().trim();
    return bonsCommande.filter(bc =>
      bc.bc_number.toLowerCase().includes(term) ||
      bc.third_party_name?.toLowerCase().includes(term) ||
      bc.items.some(item => item.designation.toLowerCase().includes(term))
    );
  }, [bonsCommande, searchTerm]);

  const paginatedBC = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBC.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBC, currentPage]);

  const totalPages = Math.ceil(filteredBC.length / ITEMS_PER_PAGE);

  const toBCPDFData = (bc: BonCommande): DevisPDFData => ({
    devis_number: bc.bc_number,
    devis_date: bc.bc_date,
    type: bc.type,
    third_party_name: bc.third_party_name,
    third_party_address: bc.third_party_address,
    third_party_tax_id: bc.third_party_tax_id,
    third_party_phone: bc.third_party_phone,
    items: bc.items,
    total_amount: bc.total_amount,
    notes: bc.notes,
    is_ttc: bc.is_ttc,
  });

  const handlePreview = useCallback(async (bc: BonCommande) => {
    setIsGenerating(bc.id);
    try {
      const url = await getDevisPDFBlobUrl(toBCPDFData(bc));
      setPreviewTitle(`BC ${bc.bc_number}`);
      setPreviewUrl(url);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const handleDownload = useCallback(async (bc: BonCommande) => {
    setIsGenerating(bc.id);
    try {
      await downloadDevisPDF(toBCPDFData(bc));
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  if (bonsCommande.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Mes Bons de Commande</h3>
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Aucun bon de commande. Convertissez un devis depuis l'onglet "Mes Devis".</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h3 className="text-lg font-semibold text-foreground">Mes Bons de Commande</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
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
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredBC.length} BC</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° BC</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Devis Source</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tiers</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Créé par</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">PDF</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBC.map(bc => {
                const totalQty = bc.items.reduce((s, i) => s + i.quantity, 0);
                const generating = isGenerating === bc.id;
                return (
                  <tr key={bc.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        bc.type === 'entrant' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                      }`}>
                        {bc.type === 'entrant' ? '📥 Entrant' : '📤 Sortant'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{bc.bc_number}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{bc.devis_number || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(bc.bc_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{bc.third_party_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{bc.creator_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {bc.items.length} articles ({totalQty} unités)
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {(() => {
                        const totals = computeDevisTotals(bc.items, false);
                        return totals.totalFinal > 1 ? `${totals.totalFinal.toFixed(3)} TND` : '-';
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePreview(bc)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Prévisualiser PDF"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDownload(bc)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {(isAdminOrMod || (currentUserId && bc.created_by === currentUserId)) && (
                        <button onClick={() => setDeleteConfirm(bc)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le BC {deleteConfirm?.bc_number} sera supprimé définitivement.
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

      {/* PDF Preview */}
      <Dialog open={!!previewUrl} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full h-[75vh] border rounded" title="Aperçu BC" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

BonCommandeList.displayName = 'BonCommandeList';

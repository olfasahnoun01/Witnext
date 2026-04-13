import { memo, useMemo, useState, useCallback } from 'react';
import { FileSignature, Trash2, Download, Eye, Loader2, Search, X, Plus, Edit, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Devis } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface BonAchatListProps {
  bonsAchat: Devis[];
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onDelete: (ba: Devis) => void;
  onAdd: () => void;
  onEdit: (ba: Devis) => void;
}

const ITEMS_PER_PAGE = 10;

export const BonAchatList = memo(({ bonsAchat, currentUserId, isAdminOrMod, onDelete, onAdd, onEdit }: BonAchatListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBA = useMemo(() => {
    if (!searchTerm.trim()) return bonsAchat;
    const term = searchTerm.toLowerCase().trim();
    return bonsAchat.filter(ba =>
      ba.devis_number.toLowerCase().includes(term) ||
      ba.third_party_name?.toLowerCase().includes(term) ||
      ba.items.some(item => item.designation.toLowerCase().includes(term))
    );
  }, [bonsAchat, searchTerm]);

  const paginatedBA = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBA.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBA, currentPage]);

  const totalPages = Math.ceil(filteredBA.length / ITEMS_PER_PAGE);

  const toBAPDFData = (ba: Devis): DevisPDFData => ({
    devis_number: ba.devis_number,
    devis_date: ba.devis_date,
    type: ba.type,
    third_party_name: ba.third_party_name,
    third_party_address: ba.third_party_address,
    third_party_tax_id: ba.third_party_tax_id,
    third_party_phone: ba.third_party_phone,
    items: ba.items,
    total_amount: ba.total_amount,
    notes: ba.notes,
    is_ttc: ba.is_ttc,
    is_bc: ba.is_bc,
    is_ba: ba.is_ba,
  });

  const handlePreview = useCallback(async (ba: Devis) => {
    setIsGenerating(ba.id);
    try {
      const url = await getDevisPDFBlobUrl(toBAPDFData(ba));
      setPreviewTitle(`BA ${ba.devis_number}`);
      setPreviewUrl(url);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const handleDownload = useCallback(async (ba: Devis) => {
    setIsGenerating(ba.id);
    try {
      await downloadDevisPDF(toBAPDFData(ba));
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  if (bonsAchat.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Mes Bons d'Achat</h3>
        <div className="text-center py-12">
          <FileSignature className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Aucun bon d'achat. Convertissez un bon de commande depuis l'onglet "Mes BC".</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-foreground">Mes Bons d'Achat</h3>
            <Button onClick={onAdd} size="sm" className="h-8 gap-2">
              <Plus className="w-4 h-4" />
              Ajouter BA
            </Button>
          </div>
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
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredBA.length} BA</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° BA</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">BC Source</th>
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
              {paginatedBA.map(ba => {
                const totalQty = ba.items.reduce((s, i) => s + i.quantity, 0);
                const generating = isGenerating === ba.id;
                return (
                  <tr key={ba.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ba.type === 'entrant' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                      }`}>
                        {ba.type === 'entrant' ? '📥 Entrant' : '📤 Sortant'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{ba.devis_number}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{ba.source_devis_number || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(ba.devis_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{ba.third_party_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{ba.creator_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {ba.items.length} articles ({totalQty} unités)
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {(() => {
                        const totals = computeDevisTotals(ba.items, false);
                        return totals.totalFinal > 1 ? `${totals.totalFinal.toFixed(3)} TND` : '-';
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePreview(ba)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Prévisualiser PDF"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDownload(ba)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(ba)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Modif</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(ba)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon d'achat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le BA {deleteConfirm?.devis_number} sera supprimé définitivement.
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
            <iframe src={previewUrl} className="w-full h-[75vh] border rounded" title="Aperçu BA" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

BonAchatList.displayName = 'BonAchatList';

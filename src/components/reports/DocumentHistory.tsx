import { memo, useMemo, useState } from 'react';
import { History, Download, Edit, Trash2, Eye } from 'lucide-react';
import { SavedDocument, documentTypes, downloadDocumentPDF } from '@/utils/pdfGenerator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DocumentHistoryProps {
  savedDocuments: SavedDocument[];
  canEdit: boolean;
  onEdit: (doc: SavedDocument) => void;
  onDelete: (doc: SavedDocument) => void;
  deleteConfirmDoc: SavedDocument | null;
  setDeleteConfirmDoc: (doc: SavedDocument | null) => void;
}

const ITEMS_PER_PAGE = 10;

export const DocumentHistory = memo(({ savedDocuments, canEdit, onEdit, onDelete, deleteConfirmDoc, setDeleteConfirmDoc }: DocumentHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewDoc, setViewDoc] = useState<SavedDocument | null>(null);

  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return savedDocuments.slice(start, start + ITEMS_PER_PAGE);
  }, [savedDocuments, currentPage]);

  const totalPages = Math.ceil(savedDocuments.length / ITEMS_PER_PAGE);

  if (savedDocuments.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 w-[95%] mx-auto">
        <h3 className="text-lg font-semibold text-foreground mb-6">Historique des Documents</h3>
        <div className="text-center py-12">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Aucun document dans l'historique.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 w-[95%] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Historique des Documents</h3>
        <span className="text-sm text-muted-foreground">{savedDocuments.length} documents</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N°</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client/Fournisseur</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDocs.map(doc => {
              const typeInfo = documentTypes.find(t => t.value === doc.type);
              const totalQuantity = doc.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      doc.type === 'bon_entree' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {typeInfo?.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">{doc.doc_number}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {new Date(doc.doc_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{doc.third_party_name || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setViewDoc(doc)}
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Voir les articles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {doc.items.length} articles ({totalQuantity} unités)
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">
                    {doc.total_amount > 0 ? `${doc.total_amount.toFixed(3)} TND` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadDocumentPDF(doc)}
                        className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => onEdit(doc)}
                            className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmDoc(doc)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Supprimer"
                          >
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
      {/* Items Detail Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Articles du document {viewDoc?.doc_number}</DialogTitle>
          </DialogHeader>
          {viewDoc && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Réf</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Désignation</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prix</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qté</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewDoc.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 text-foreground">{item.ref || '-'}</td>
                      <td className="py-2 px-3 text-foreground font-medium">{item.designation}</td>
                      <td className="py-2 px-3 text-right text-foreground">{item.price ? `${item.price.toFixed(3)} TND` : '-'}</td>
                      <td className="py-2 px-3 text-right text-foreground">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{item.price ? `${(item.price * item.quantity).toFixed(3)} TND` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={4} />
                    <td className="py-2 px-3 text-right font-semibold text-foreground">Total</td>
                    <td className="py-2 px-3 text-right font-semibold text-primary">{viewDoc.total_amount > 0 ? `${viewDoc.total_amount.toFixed(3)} TND` : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

DocumentHistory.displayName = 'DocumentHistory';

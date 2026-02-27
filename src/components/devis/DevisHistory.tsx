import { memo, useMemo, useState, useCallback } from 'react';
import { History, Edit, Trash2, Eye, Download, Loader2, Search, X, List, Filter } from 'lucide-react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface DevisHistoryProps {
  savedDevis: Devis[];
  canEdit: boolean;
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (d: Devis) => void;
  onDelete: (d: Devis) => void;
}

const ITEMS_PER_PAGE = 10;


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

export const DevisHistory = memo(({ savedDevis, canEdit, currentUserId, isAdminOrMod, onEdit, onDelete }: DevisHistoryProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsDevis, setItemsDevis] = useState<Devis | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState('all');

  // Extract unique fournisseurs from all devis items
  const allFournisseurs = useMemo(() => {
    const set = new Set<string>();
    savedDevis.forEach(d => d.items.forEach(item => {
      if (item.fournisseur?.trim()) set.add(item.fournisseur.trim());
    }));
    return [...set].sort();
  }, [savedDevis]);

  const filteredDevis = useMemo(() => {
    let result = savedDevis;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(d =>
        d.items.some(item =>
          item.designation.toLowerCase().includes(term) ||
          item.fournisseur?.toLowerCase().includes(term)
        )
      );
    }
    if (selectedFournisseur !== 'all') {
      result = result.filter(d =>
        d.items.some(item => item.fournisseur?.trim() === selectedFournisseur)
      );
    }
    return result;
  }, [savedDevis, searchTerm, selectedFournisseur]);

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
          <div className="flex items-center gap-2 flex-wrap">
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
            <Select value={selectedFournisseur} onValueChange={v => { setSelectedFournisseur(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-48 bg-background">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Fournisseur" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                {allFournisseurs.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Créé par</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Mode</th>
                
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
                    <td className="py-3 px-4 text-sm text-muted-foreground">{d.creator_name || '-'}</td>
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
                      {(() => {
                        let totalTTC = 0;
                        d.items.forEach(i => {
                          const lineHT = i.prix_ttc * i.quantity;
                          const remiseDT = i.remise > 0 ? lineHT * (i.remise / 100) : 0;
                          const lineNet = lineHT - remiseDT;
                          totalTTC += lineNet + lineNet * ((i.tva ?? 19) / 100);
                        });
                        const finalTotal = totalTTC + 1;
                        return finalTotal > 1 ? `${finalTotal.toFixed(3)} TND` : '-';
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        d.is_ttc ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                      }`}>
                        {d.is_ttc ? 'TTC' : 'HT'}
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
                          <button onClick={() => onEdit(d)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Modifier">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {(isAdminOrMod || (currentUserId && d.created_by === currentUserId)) && (
                          <button onClick={() => setDeleteConfirm(d)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
        <DialogContent className="w-[80vw] max-w-[80vw] max-h-[85vh] overflow-auto">
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
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prix U Vente</th>
                    {itemsDevis.type === 'sortant' && (
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prix Achat</th>
                    )}
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Remise</th>
                    {itemsDevis.is_ttc && <th className="text-center py-2 px-3 font-medium text-muted-foreground">TVA</th>}
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qté</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsDevis.items.map((item, idx) => {
                    const tvaRate = (item.tva ?? 19) / 100;
                    const prixApresRemise = item.remise > 0 ? item.prix_ttc * (1 - item.remise / 100) : item.prix_ttc;
                    const sousTotalTTC = itemsDevis.is_ttc ? prixApresRemise * item.quantity * (1 + tvaRate) : prixApresRemise * item.quantity;
                    return (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 text-foreground font-medium">{item.designation}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.fournisseur || '-'}</td>
                        <td className="py-2 px-3 text-right text-foreground">{item.prix_ttc.toFixed(3)} TND</td>
                        {itemsDevis.type === 'sortant' && (
                          <td className="py-2 px-3 text-right text-muted-foreground">{item.prix_achat != null && item.prix_achat > 0 ? `${item.prix_achat.toFixed(3)} TND` : '-'}</td>
                        )}
                        <td className="py-2 px-3 text-right text-muted-foreground">{item.remise > 0 ? `${item.remise}%` : '-'}</td>
                        {itemsDevis.is_ttc && <td className="py-2 px-3 text-center text-muted-foreground">{(item as any).tva ?? 19}%</td>}
                        <td className="py-2 px-3 text-right text-foreground">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium text-foreground">{sousTotalTTC.toFixed(3)} TND</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    let totalHT = 0, totalRemise = 0, totalNet = 0, totalTVA = 0, totalTTC = 0;
                    itemsDevis.items.forEach(i => {
                      const lineHT = i.prix_ttc * i.quantity;
                      const remiseDT = i.remise > 0 ? lineHT * (i.remise / 100) : 0;
                      const lineNet = lineHT - remiseDT;
                      const lineTVA = lineNet * ((i.tva ?? 19) / 100);
                      totalHT += lineHT;
                      totalRemise += remiseDT;
                      totalNet += lineNet;
                      totalTVA += lineTVA;
                      totalTTC += lineNet + lineTVA;
                    });
                    const baseColSpan = itemsDevis.type === 'sortant' ? 7 : 6;
                    const colSpan = itemsDevis.is_ttc ? baseColSpan : baseColSpan - 1;
                    return (
                      <>
                        <tr className="border-t-2 border-border">
                          <td colSpan={colSpan} />
                          <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Total HT</td>
                          <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">{totalHT.toFixed(3)} TND</td>
                        </tr>
                        {totalRemise > 0 && (
                          <tr>
                            <td colSpan={colSpan} />
                            <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Remise</td>
                            <td className="py-1.5 px-3 text-right text-sm font-medium text-destructive whitespace-nowrap">-{totalRemise.toFixed(3)} TND</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={colSpan} />
                          <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Net HT</td>
                          <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">{totalNet.toFixed(3)} TND</td>
                        </tr>
                        {itemsDevis.is_ttc && (
                          <>
                            <tr>
                              <td colSpan={colSpan} />
                              <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">TVA</td>
                              <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">{totalTVA.toFixed(3)} TND</td>
                            </tr>
                            <tr>
                              <td colSpan={colSpan} />
                              <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Total TTC</td>
                              <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">{totalTTC.toFixed(3)} TND</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td colSpan={colSpan} />
                          <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Timbre fiscal</td>
                          <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">1.000 TND</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td colSpan={colSpan} />
                          <td className="py-2 px-3 text-right font-semibold text-foreground whitespace-nowrap">{itemsDevis.is_ttc ? 'Total TTC' : 'Total HT'}</td>
                          <td className="py-2 px-3 text-right font-bold text-primary whitespace-nowrap">{(itemsDevis.is_ttc ? totalTTC + 1 : totalNet + 1).toFixed(3)} TND</td>
                        </tr>
                      </>
                    );
                  })()}
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

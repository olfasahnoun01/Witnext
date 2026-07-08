import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { toast } from 'sonner';
import { Truck, Trash2, Download, Eye, Loader2, Search, X, Receipt, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BonLivraison } from '@/types';
import { computeSavedDocumentTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  createFactureFromBonLivraisonVente,
  createFactureFromMultipleBonsLivraisonVente,
  fetchBlIdsHavingFactureVente,
} from '@/services/factureService';
import { validateBlMergeForFacture } from '@/lib/mergeCommercialDocuments';
import { Checkbox } from '@/components/ui/checkbox';
import { CommercialAttachmentBadges } from '@/components/shared/CommercialAttachmentBadges';
import { sortDevisListRecentFirst } from '@/lib/devisListLayout';
import { documentAuditTableHeadCells, DocumentAuditTableCells } from '@/components/devis/DocumentAuditTableColumns';
import { VENTES_EXCEL_TABLE_CLASS } from '@/lib/tableStyles';
import { cn } from '@/lib/utils';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';

interface BonLivraisonListProps {
  bonsLivraison: BonLivraison[];
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (bl: BonLivraison) => void;
  onDelete: (bl: BonLivraison) => void;
  onRefresh?: () => void;
}

const toBlPDFData = (bl: BonLivraison): DevisPDFData => ({
  devis_number: bl.devis_number,
  devis_date: bl.devis_date,
  type: 'sortant',
  third_party_name: bl.third_party_name,
  third_party_address: bl.third_party_address,
  third_party_tax_id: bl.third_party_tax_id,
  third_party_phone: bl.third_party_phone,
  items: bl.items,
  total_amount: bl.total_amount,
  notes: bl.notes,
  is_ttc: bl.is_ttc,
  is_bc: false,
  is_ba: false,
  is_bl: true,
});

export const BonLivraisonList = memo(({
  bonsLivraison,
  currentUserId,
  isAdminOrMod,
  onEdit,
  onDelete,
  onRefresh,
}: BonLivraisonListProps) => {
  const [deleteConfirm, setDeleteConfirm] = useState<BonLivraison | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [blIdsWithFacture, setBlIdsWithFacture] = useState<Set<number>>(new Set());
  const [factureBusyId, setFactureBusyId] = useState<number | null>(null);
  const [selectedBlIds, setSelectedBlIds] = useState<Set<number>>(new Set());
  const [mergeFactureBusy, setMergeFactureBusy] = useState(false);

  const refreshBlIdsWithFacture = useCallback(() => {
    void fetchBlIdsHavingFactureVente().then((ids) => setBlIdsWithFacture(ids));
  }, []);

  useEffect(() => {
    refreshBlIdsWithFacture();
  }, [bonsLivraison, refreshBlIdsWithFacture]);

  useEffect(() => {
    const onRefreshFactures = () => refreshBlIdsWithFacture();
    window.addEventListener('grosafe:factures-refresh', onRefreshFactures);
    return () => window.removeEventListener('grosafe:factures-refresh', onRefreshFactures);
  }, [refreshBlIdsWithFacture]);

  const filtered = useMemo(() => {
    let result = bonsLivraison.filter((bl) => bl.type === 'vente');
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (bl) =>
          bl.devis_number.toLowerCase().includes(term) ||
          bl.third_party_name?.toLowerCase().includes(term) ||
          bl.source_bc_number?.toLowerCase().includes(term)
      );
    }
    return sortDevisListRecentFirst(result);
  }, [bonsLivraison, searchTerm]);

  const {
    slice: blPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(filtered, searchTerm);

  const selectedBlList = useMemo(
    () => bonsLivraison.filter((bl) => selectedBlIds.has(bl.id)),
    [bonsLivraison, selectedBlIds]
  );

  const handlePreview = useCallback(async (bl: BonLivraison) => {
    setIsGenerating(bl.id);
    try {
      const url = await getDevisPDFBlobUrl(toBlPDFData(bl));
      setPreviewTitle(`BL ${bl.devis_number}`);
      setPreviewUrl(url);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const handleDownload = useCallback(async (bl: BonLivraison) => {
    setIsGenerating(bl.id);
    try {
      await downloadDevisPDF(toBlPDFData(bl));
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  const handleGenerateFacture = useCallback(async (bl: BonLivraison) => {
    if (blIdsWithFacture.has(bl.id)) {
      toast.info('Une facture existe déjà pour ce BL. Ouvrez Ventes → Factures.');
      return;
    }
    const ok = window.confirm(`Générer la facture à partir du BL ${bl.devis_number} ?`);
    if (!ok) return;
    setFactureBusyId(bl.id);
    try {
      const result = await createFactureFromBonLivraisonVente(bl);
      if (result.success) {
        toast.success(`Facture ${result.numero} créée. Retrouvez-la dans Ventes → Factures.`);
        setBlIdsWithFacture((prev) => new Set(prev).add(bl.id));
        window.dispatchEvent(new CustomEvent('grosafe:factures-refresh'));
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setFactureBusyId(null);
    }
  }, [blIdsWithFacture, onRefresh]);

  const handleMergeFacture = useCallback(async () => {
    const check = validateBlMergeForFacture(selectedBlList);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const blocked = selectedBlList.find((bl) => blIdsWithFacture.has(bl.id));
    if (blocked) {
      toast.error(`Le BL ${blocked.devis_number} est déjà facturé.`);
      return;
    }
    const numbers = selectedBlList.map((b) => b.devis_number).join(', ');
    if (!window.confirm(`Fusionner les BL ${numbers} en une seule facture ?`)) return;

    setMergeFactureBusy(true);
    try {
      const result = await createFactureFromMultipleBonsLivraisonVente(selectedBlList);
      if (result.success) {
        toast.success(`Facture ${result.numero} créée.`);
        setBlIdsWithFacture((prev) => {
          const next = new Set(prev);
          selectedBlList.forEach((bl) => next.add(bl.id));
          return next;
        });
        setSelectedBlIds(new Set());
        window.dispatchEvent(new CustomEvent('grosafe:factures-refresh'));
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setMergeFactureBusy(false);
    }
  }, [selectedBlList, blIdsWithFacture, onRefresh]);

  if (bonsLivraison.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Bons de Livraison</h3>
        <div className="text-center py-12">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Aucun bon de livraison. Créez-en un depuis la liste des bons de commande (bouton BL).
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-emerald-500/25 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 bg-emerald-500/5 -mx-2 px-2 py-3 rounded-lg">
          <h3 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100">Bons de Livraison</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 w-56"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} BL</span>
            {selectedBlIds.size >= 2 && (
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={mergeFactureBusy}
                onClick={() => void handleMergeFacture()}
              >
                {mergeFactureBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitMerge className="w-4 h-4" />
                )}
                Fusionner en 1 facture ({selectedBlIds.size})
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Les BL sont créés depuis les BC vente. La facture se génère ici après livraison. Liste paginée (10 par page).
        </p>

        <div className={cn('overflow-x-auto overflow-y-auto max-h-[min(65vh,36rem)] rounded-lg border border-emerald-500/25', VENTES_EXCEL_TABLE_CLASS)}>
          <table>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 w-10" aria-label="Sélection" />
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° BL</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">BC source</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Créé par</th>
                {documentAuditTableHeadCells}
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fichiers</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">PDF</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun BL pour cette recherche.
                  </td>
                </tr>
              ) : (
                blPage.map((bl) => {
                  const generating = isGenerating === bl.id;
                  const totalQty = bl.items.reduce((s, i) => s + i.quantity, 0);
                  const canDelete = isAdminOrMod || (currentUserId && bl.created_by === currentUserId);
                  return (
                    <tr key={bl.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">
                        <Checkbox
                          checked={selectedBlIds.has(bl.id)}
                          disabled={blIdsWithFacture.has(bl.id)}
                          onCheckedChange={(v) => {
                            setSelectedBlIds((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(bl.id);
                              else next.delete(bl.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">{bl.devis_number}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{bl.source_bc_number || '-'}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatAppDate(bl.devis_date)}
                      </td>
                      <td className="py-3 px-4 text-sm">{bl.third_party_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{bl.creator_name || '-'}</td>
                      <DocumentAuditTableCells doc={bl} />
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {bl.items.length} ({totalQty} u.)
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">
                        {(() => {
                          const totals = computeSavedDocumentTotals(bl);
                          return totals.totalFinal > 1 ? `${totals.totalFinal.toFixed(3)} TND` : '-';
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <CommercialAttachmentBadges attachments={bl.attachment_urls} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void handlePreview(bl)}
                            disabled={generating}
                            className="p-1.5 rounded hover:bg-primary/10"
                            title="Prévisualiser"
                          >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload(bl)}
                            disabled={generating}
                            className="p-1.5 rounded hover:bg-primary/10"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            disabled={blIdsWithFacture.has(bl.id) || factureBusyId === bl.id}
                            onClick={() => void handleGenerateFacture(bl)}
                          >
                            {factureBusyId === bl.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Receipt className="w-3.5 h-3.5" />
                            )}
                            {blIdsWithFacture.has(bl.id) ? 'Facturé' : 'Facture'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onEdit(bl)}>
                            Modifier
                          </Button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(bl)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          onPageChange={setPage}
        />
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le BL {deleteConfirm?.devis_number} ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) onDelete(deleteConfirm);
                setDeleteConfirm(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} title={previewTitle} className="w-full h-[70vh] rounded border" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

BonLivraisonList.displayName = 'BonLivraisonList';

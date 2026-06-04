import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { History, Edit, Trash2, Eye, Download, Loader2, Search, X, List, Filter, Package, FileText, Plus, Truck, MoreHorizontal, Printer, GitMerge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CommercialAttachmentBadges } from '@/components/shared/CommercialAttachmentBadges';
import { EchantillonModal } from './EchantillonModal';
import { Input } from '@/components/ui/input';
import { Devis } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { computeDevisLine, computeDevisTotals } from '@/lib/devisPricing';
import {
  buildDocumentPdfFileName,
  downloadDevisPDF,
  getDevisPDFBlobUrl,
  printPdfPreviewIframe,
  DevisPDFData,
} from '@/utils/pdfGenerator';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ACHATS_EXCEL_TABLE_CLASS, VENTES_EXCEL_TABLE_CLASS } from '@/lib/tableStyles';
import { isDevisConfirmed, sortDevisListRecentFirst } from '@/lib/devisListLayout';
import { documentAuditTableHeadCells, DocumentAuditTableCells } from '@/components/devis/DocumentAuditTableColumns';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DEVIS_TABLE_COL_COUNT = 16;

interface DevisHistoryProps {
  savedDevis: Devis[];
  canEdit: boolean;
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (d: Devis) => void;
  onDelete: (d: Devis) => void;
  onConvertToBC?: (d: Devis) => void;
  /** Fusionne plusieurs devis (même client) en un seul BC */
  onConvertMultipleToBC?: (list: Devis[]) => void;
  /** Crée un BC Fournisseur (documents v2) à partir d'un devis vente */
  onConvertToBCFournisseur?: (d: Devis) => void;
  onAdd: () => void;
  defaultTypeFilter?: 'all' | 'achat' | 'vente';
}

const devisConfirmationLabel = (status: Devis['status'] | undefined | null) =>
  isDevisConfirmed(status) ? 'Confirmé' : 'Non confirmé';

const devisConfirmationBadgeClass = (status: Devis['status'] | undefined | null) =>
  isDevisConfirmed(status)
    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
    : 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800';

const toDevisPDFData = (d: Devis): DevisPDFData => ({
  devis_number: d.devis_number,
  devis_date: d.devis_date,
  type: (d.type === 'vente' || d.type === 'sortant') ? 'sortant' : 'entrant',
  third_party_name: d.third_party_name,
  third_party_address: d.third_party_address,
  third_party_tax_id: d.third_party_tax_id,
  third_party_phone: d.third_party_phone,
  items: d.items,
  total_amount: d.total_amount,
  notes: d.notes,
  is_ttc: d.is_ttc,
  is_bc: d.is_bc,
  is_ba: d.is_ba,
});

export const DevisHistory = memo(({ savedDevis, canEdit, currentUserId, isAdminOrMod, onEdit, onDelete, onConvertToBC, onConvertMultipleToBC, onConvertToBCFournisseur, onAdd, defaultTypeFilter }: DevisHistoryProps) => {
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');
  const [printWhenPreviewReady, setPrintWhenPreviewReady] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsDevis, setItemsDevis] = useState<Devis | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState('all');
  const [echantillonDevis, setEchantillonDevis] = useState<{ id: number; number: string } | null>(null);
  const [echantillonCounts, setEchantillonCounts] = useState<Record<number, number>>({});
  const [selectedType, setSelectedType] = useState<'all' | 'achat' | 'vente'>(defaultTypeFilter || 'all');
  const [selectedConfirmation, setSelectedConfirmation] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [selectedDevisIds, setSelectedDevisIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (defaultTypeFilter) setSelectedType(defaultTypeFilter);
  }, [defaultTypeFilter]);

  // Fetch envoyé echantillon counts for all vente devis
  useEffect(() => {
    const venteIds = savedDevis.filter(d => d.type === 'vente').map(d => d.id);
    if (venteIds.length === 0) return;

    const fetchCounts = async () => {
      const { data, error } = await supabase
        .from('echantillons')
        .select('devis_id, id')
        .in('devis_id', venteIds)
        .eq('status', 'envoyé');
      if (!error && data) {
        const counts: Record<number, number> = {};
        data.forEach((r: any) => {
          counts[r.devis_id] = (counts[r.devis_id] || 0) + 1;
        });
        setEchantillonCounts(counts);
      }
    };
    fetchCounts();
  }, [savedDevis, echantillonDevis]);

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
        d.devis_number.toLowerCase().includes(term) ||
        d.third_party_name?.toLowerCase().includes(term) ||
        d.creator_name?.toLowerCase().includes(term) ||
        d.modifier_name?.toLowerCase().includes(term) ||
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
    if (selectedType !== 'all') {
      result = result.filter(d => d.type === selectedType);
    }
    if (selectedConfirmation === 'confirmed') {
      result = result.filter((d) => isDevisConfirmed(d.status));
    } else if (selectedConfirmation === 'unconfirmed') {
      result = result.filter((d) => !isDevisConfirmed(d.status));
    }
    return result;
  }, [savedDevis, searchTerm, selectedFournisseur, selectedType, selectedConfirmation]);

  const devisSorted = useMemo(
    () => sortDevisListRecentFirst(filteredDevis),
    [filteredDevis]
  );

  const listResetKey = `${searchTerm}|${selectedFournisseur}|${selectedType}|${selectedConfirmation}`;
  const {
    slice: devisPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(devisSorted, listResetKey);

  const openPdfPreview = useCallback(async (d: Devis, options?: { printAfterLoad?: boolean }) => {
    setIsGenerating(d.id);
    try {
      const pdfData = toDevisPDFData(d);
      const url = await getDevisPDFBlobUrl(pdfData);
      setPreviewTitle(`Devis ${d.devis_number}`);
      setPreviewDownloadName(buildDocumentPdfFileName(pdfData));
      setPrintWhenPreviewReady(!!options?.printAfterLoad);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Error generating preview:', err);
    } finally {
      setIsGenerating(null);
    }
  }, []);

  const handlePreview = useCallback((d: Devis) => {
    void openPdfPreview(d);
  }, [openPdfPreview]);

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

  const handlePrint = useCallback((d: Devis) => {
    void openPdfPreview(d, { printAfterLoad: true });
  }, [openPdfPreview]);

  const printFromPreviewIframe = useCallback(() => {
    printPdfPreviewIframe(previewIframeRef.current);
  }, []);

  const handlePreviewIframeLoad = useCallback(() => {
    if (!printWhenPreviewReady) return;
    setPrintWhenPreviewReady(false);
    printFromPreviewIframe();
  }, [printWhenPreviewReady, printFromPreviewIframe]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
    setPreviewDownloadName('');
    setPrintWhenPreviewReady(false);
  }, [previewUrl]);

  const listAccent = selectedType === 'achat' ? 'achat' : selectedType === 'vente' ? 'vente' : (defaultTypeFilter === 'achat' ? 'achat' : 'vente');
  const excelTableClass = listAccent === 'achat' ? ACHATS_EXCEL_TABLE_CLASS : VENTES_EXCEL_TABLE_CLASS;
  const listCardBorder = listAccent === 'achat' ? 'border-orange-500/25' : 'border-emerald-500/25';
  const listHeaderBg = listAccent === 'achat' ? 'bg-orange-500/5' : 'bg-emerald-500/5';

  const showMergeSelection = Boolean(onConvertMultipleToBC && onConvertToBC);

  const toggleDevisSelection = useCallback((id: number, checked: boolean) => {
    setSelectedDevisIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectedDevisList = useMemo(
    () => savedDevis.filter((d) => selectedDevisIds.has(d.id)),
    [savedDevis, selectedDevisIds]
  );

  const handleMergeSelectedToBC = useCallback(() => {
    if (!onConvertMultipleToBC || selectedDevisList.length < 2) return;
    onConvertMultipleToBC(selectedDevisList);
    setSelectedDevisIds(new Set());
  }, [onConvertMultipleToBC, selectedDevisList]);

  const devisTableHead = (
    <thead>
      <tr>
        {showMergeSelection && <th className="text-left w-10 py-3 px-2" aria-label="Sélection" />}
        <th className="text-left w-12">Actions</th>
        <th className="text-left">Type</th>
        <th className="text-left">N°</th>
        <th className="text-left">Date</th>
        <th className="text-left">Tiers</th>
        <th className="text-left">Créé par</th>
        {documentAuditTableHeadCells}
        <th className="text-left">Statut</th>
        <th className="text-left">Articles</th>
        <th className="text-left">Total</th>
        <th className="text-left">Mode</th>
        <th className="text-left">Fichiers</th>
        <th className="text-left">Échantillon</th>
        <th className="text-left">PDF</th>
      </tr>
    </thead>
  );

  const renderDevisActionsMenu = (d: Devis) => {
    const rowBusy = isGenerating === d.id;
    const canModify =
      (isAdminOrMod || (currentUserId && d.created_by === currentUserId)) && canEdit && d.status !== 'accepté';
    const canDelete = isAdminOrMod || (currentUserId && d.created_by === currentUserId);
    const showBc = !!onConvertToBC && d.type === 'vente';
    const showBcFournisseur = !!onConvertToBCFournisseur && d.type === 'vente';
    const showOtherActions = showBc || showBcFournisseur || canModify || canDelete;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={rowBusy}
            aria-label="Actions sur le devis"
          >
            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem disabled={rowBusy} onClick={() => void handlePrint(d)}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </DropdownMenuItem>
          {showOtherActions && <DropdownMenuSeparator />}
          {showBc && (
            <DropdownMenuItem onClick={() => onConvertToBC!(d)}>
              <FileText className="mr-2 h-4 w-4" />
              Créer BC
            </DropdownMenuItem>
          )}
          {showBcFournisseur && (
            <DropdownMenuItem onClick={() => onConvertToBCFournisseur!(d)}>
              <Truck className="mr-2 h-4 w-4" />
              BC Fournisseur
            </DropdownMenuItem>
          )}
          {(showBc || showBcFournisseur) && (canModify || canDelete) && <DropdownMenuSeparator />}
          {canModify && (
            <DropdownMenuItem onClick={() => onEdit(d)}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteConfirm(d)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderDevisRow = (d: Devis) => {
    const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
    const generating = isGenerating === d.id;
    return (
      <tr key={d.id}>
        {showMergeSelection && (
          <td className="py-2 px-2">
            <Checkbox
              checked={selectedDevisIds.has(d.id)}
              onCheckedChange={(v) => toggleDevisSelection(d.id, v === true)}
              aria-label={`Sélectionner ${d.devis_number}`}
            />
          </td>
        )}
        <td className="py-2 px-2">{renderDevisActionsMenu(d)}</td>
        <td className="py-3 px-4">
          <span className={cn(
            'px-2 py-1 rounded text-xs font-medium border',
            d.type === 'achat'
              ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200'
              : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200'
          )}>
            {d.type === 'achat' ? '📥 Achat' : '📤 Vente'}
          </span>
        </td>
        <td className="py-3 px-4 text-sm font-medium text-foreground">{d.devis_number}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {new Date(d.devis_date).toLocaleDateString('fr-FR')}
        </td>
        <td className="py-3 px-4 text-sm text-foreground">{d.third_party_name || '-'}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{d.creator_name || '-'}</td>
        <DocumentAuditTableCells doc={d} />
        <td className="py-3 px-4 text-sm">
          <Badge
            variant="outline"
            className={cn('font-medium normal-case', devisConfirmationBadgeClass(d.status))}
            title={d.status ? `Statut détaillé : ${d.status}` : undefined}
          >
            {devisConfirmationLabel(d.status)}
          </Badge>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
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
            const totals = computeDevisTotals(d.items, false);
            return totals.totalFinal > 1 ? `${totals.totalFinal.toFixed(3)} TND` : '-';
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
          <CommercialAttachmentBadges attachments={d.attachment_urls} />
        </td>
        <td className="py-3 px-4">
          {d.type === 'vente' ? (
            <button
              type="button"
              onClick={() => setEchantillonDevis({ id: d.id, number: d.devis_number })}
              className="relative p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Gérer les échantillons"
            >
              <Package className="w-4 h-4" />
              {(echantillonCounts[d.id] || 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-none">
                  {echantillonCounts[d.id]}
                </span>
              )}
            </button>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePreview(d)}
              disabled={generating}
              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Prévisualiser PDF"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleDownload(d)}
              disabled={generating}
              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Télécharger PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (savedDevis.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Mes Devis</h3>
        <div className="text-center py-12">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Aucun devis dans l'historique.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn('bg-card rounded-xl border p-6', listCardBorder)}>
        <div className={cn('flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 -mx-2 px-2 py-3 rounded-lg', listHeaderBg)}>
          <div className="flex items-center gap-4">
            <h3 className={cn('text-lg font-semibold', listAccent === 'achat' ? 'text-orange-950 dark:text-orange-100' : 'text-emerald-950 dark:text-emerald-100')}>
              Mes Devis
            </h3>
            <Button
              onClick={onAdd}
              size="sm"
              className={cn('h-8 gap-2', listAccent === 'achat' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700')}
            >
              <Plus className="w-4 h-4" />
              Ajouter Devis
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); }}
                className="pl-9 pr-8 h-9 w-56"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={selectedType} onValueChange={v => { setSelectedType(v as any); }}>
              <SelectTrigger className="h-9 w-32 bg-background">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="achat">📥 Achat</SelectItem>
                <SelectItem value="vente">📤 Vente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedFournisseur} onValueChange={v => { setSelectedFournisseur(v); }}>
              <SelectTrigger className="h-9 w-44 bg-background">
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
            <Select value={selectedConfirmation} onValueChange={(v) => setSelectedConfirmation(v as typeof selectedConfirmation)}>
              <SelectTrigger className="h-9 w-40 bg-background">
                <SelectValue placeholder="Confirmation" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                <SelectItem value="unconfirmed">Non confirmé</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredDevis.length} devis</span>
            {showMergeSelection && selectedDevisIds.size >= 2 && (
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleMergeSelectedToBC}
              >
                <GitMerge className="w-4 h-4" />
                Fusionner en 1 BC ({selectedDevisIds.size})
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Tous les devis dans une seule liste (plus récent en haut), 10 par page. Statut : confirmé ou non confirmé.
        </p>

        <div className={cn('overflow-x-auto overflow-y-auto max-h-[min(65vh,36rem)] rounded-lg border', listCardBorder, excelTableClass)}>
          <table>
            {devisTableHead}
            <tbody>
              {devisSorted.length === 0 ? (
                <tr>
                  <td colSpan={DEVIS_TABLE_COL_COUNT} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun devis pour ces filtres.
                  </td>
                </tr>
              ) : (
                devisPage.map(renderDevisRow)
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
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qté</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fournisseur</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">P.U HT</th>
                    {itemsDevis.type === 'vente' && (
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prix Achat</th>
                    )}
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Remise</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">TVA</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sous-total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsDevis.items.map((item, idx) => {
                    const line = computeDevisLine(item, false);
                    return (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 text-foreground font-medium">{item.designation}</td>
                        <td className="py-2 px-3 text-right text-foreground">{item.quantity}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.fournisseur || '-'}</td>
                        <td className="py-2 px-3 text-right text-foreground">{line.unitHT.toFixed(3)} TND</td>
                        {itemsDevis.type === 'vente' && (
                          <td className="py-2 px-3 text-right text-muted-foreground">{item.prix_achat != null && item.prix_achat > 0 ? `${item.prix_achat.toFixed(3)} TND` : '-'}</td>
                        )}
                        <td className="py-2 px-3 text-right text-muted-foreground">{item.remise > 0 ? `${item.remise}%` : '-'}</td>
                        <td className="py-2 px-3 text-center text-muted-foreground">{(item as any).tva ?? 19}%</td>
                        <td className="py-2 px-3 text-right font-medium text-foreground">{line.lineTTC.toFixed(3)} TND</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totals = computeDevisTotals(itemsDevis.items, false);
                    const { totalHT, totalRemise, totalNet, totalTVA, totalTTC } = totals;
                    const colSpan = itemsDevis.type === 'vente' ? 7 : 6;
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
                        <tr>
                          <td colSpan={colSpan} />
                          <td className="py-1.5 px-3 text-right text-sm text-muted-foreground whitespace-nowrap">Timbre fiscal</td>
                          <td className="py-1.5 px-3 text-right text-sm font-medium text-foreground whitespace-nowrap">1.000 TND</td>
                        </tr>
                        <tr className="border-t border-border">
                          <td colSpan={colSpan} />
                          <td className="py-2 px-3 text-right font-semibold text-foreground whitespace-nowrap">Total TTC</td>
                          <td className="py-2 px-3 text-right font-bold text-primary whitespace-nowrap">{(totalTTC + 1).toFixed(3)} TND</td>
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
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-2">
            <DialogTitle>{previewTitle}</DialogTitle>
            {previewUrl && (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="default" size="sm" className="gap-2" onClick={printFromPreviewIframe}>
                  <Printer className="w-4 h-4" />
                  Imprimer
                </Button>
                <a href={previewUrl} download={previewDownloadName || `${previewTitle}.pdf`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger
                  </Button>
                </a>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                ref={previewIframeRef}
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                onLoad={handlePreviewIframeLoad}
                className="h-[75vh] w-full border rounded-lg bg-muted/30"
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

      {/* Échantillon Modal */}
      <EchantillonModal
        devisId={echantillonDevis?.id ?? null}
        devisNumber={echantillonDevis?.number ?? ''}
        open={!!echantillonDevis}
        onClose={() => setEchantillonDevis(null)}
      />
    </>
  );
});

DevisHistory.displayName = 'DevisHistory';

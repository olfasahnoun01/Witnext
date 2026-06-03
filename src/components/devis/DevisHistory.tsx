import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { History, Edit, Trash2, Eye, Download, Loader2, Search, X, List, Filter, Package, FileText, Plus, Truck, ChevronDown, Inbox, ListChecks, MoreHorizontal } from 'lucide-react';
import { EchantillonModal } from './EchantillonModal';
import { Input } from '@/components/ui/input';
import { Devis } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { computeDevisLine, computeDevisTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
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
import { partitionDraftsAndRest, sortDevisListRecentFirst } from '@/lib/devisListLayout';
import { documentAuditTableHeadCells, DocumentAuditTableCells } from '@/components/devis/DocumentAuditTableColumns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DEVIS_TABLE_COL_COUNT = 14;

interface DevisHistoryProps {
  savedDevis: Devis[];
  canEdit: boolean;
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (d: Devis) => void;
  onDelete: (d: Devis) => void;
  onConvertToBC?: (d: Devis) => void;
  /** Crée un BC Fournisseur (documents v2) à partir d'un devis vente */
  onConvertToBCFournisseur?: (d: Devis) => void;
  onAdd: () => void;
  defaultTypeFilter?: 'all' | 'achat' | 'vente';
}

const devisStatusLabel = (status: Devis['status'] | undefined | null) => {
  const s = status || 'brouillon';
  const labels: Record<Devis['status'], string> = {
    brouillon: 'Brouillon',
    envoyé: 'Envoyé',
    accepté: 'Accepté',
    refusé: 'Refusé',
    confirmé: 'Confirmé',
    reçu: 'Reçu',
    intégré: 'Intégré',
  };
  return labels[s] || s;
};

const devisStatusBadgeClass = (status: Devis['status'] | undefined | null) => {
  const s = status || 'brouillon';
  switch (s) {
    case 'accepté':
    case 'intégré':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800';
    case 'confirmé':
    case 'reçu':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    case 'envoyé':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    case 'refusé':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

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

export const DevisHistory = memo(({ savedDevis, canEdit, currentUserId, isAdminOrMod, onEdit, onDelete, onConvertToBC, onConvertToBCFournisseur, onAdd, defaultTypeFilter }: DevisHistoryProps) => {
  const [deleteConfirm, setDeleteConfirm] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsDevis, setItemsDevis] = useState<Devis | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState('all');
  const [echantillonDevis, setEchantillonDevis] = useState<{ id: number; number: string } | null>(null);
  const [echantillonCounts, setEchantillonCounts] = useState<Record<number, number>>({});
  const [selectedType, setSelectedType] = useState<'all' | 'achat' | 'vente'>(defaultTypeFilter || 'all');

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
    return result;
  }, [savedDevis, searchTerm, selectedFournisseur, selectedType]);

  const { draftsSorted, restSorted } = useMemo(() => {
    const sorted = sortDevisListRecentFirst(filteredDevis);
    const { drafts, rest } = partitionDraftsAndRest(sorted);
    return { draftsSorted: drafts, restSorted: rest };
  }, [filteredDevis]);

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

  const listAccent = selectedType === 'achat' ? 'achat' : selectedType === 'vente' ? 'vente' : (defaultTypeFilter === 'achat' ? 'achat' : 'vente');
  const excelTableClass = listAccent === 'achat' ? ACHATS_EXCEL_TABLE_CLASS : VENTES_EXCEL_TABLE_CLASS;
  const listCardBorder = listAccent === 'achat' ? 'border-orange-500/25' : 'border-emerald-500/25';
  const listHeaderBg = listAccent === 'achat' ? 'bg-orange-500/5' : 'bg-emerald-500/5';

  const devisTableHead = (
    <thead>
      <tr>
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
        <th className="text-left">Échantillon</th>
        <th className="text-left">PDF</th>
      </tr>
    </thead>
  );

  const renderDevisActionsMenu = (d: Devis) => {
    const canModify =
      (isAdminOrMod || (currentUserId && d.created_by === currentUserId)) && canEdit && d.status !== 'accepté';
    const canDelete = isAdminOrMod || (currentUserId && d.created_by === currentUserId);
    const showBc = !!onConvertToBC && d.type === 'vente';
    const showBcFournisseur = !!onConvertToBCFournisseur && d.type === 'vente';
    const hasMenu = showBc || showBcFournisseur || canModify || canDelete;

    if (!hasMenu) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Actions sur le devis"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
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
            className={cn('font-medium normal-case', devisStatusBadgeClass(d.status))}
            title={d.status ? String(d.status) : undefined}
          >
            {devisStatusLabel(d.status)}
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
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredDevis.length} devis</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Classement type boîte mail : brouillons séparés des autres statuts ; le plus récent en haut dans chaque groupe.
        </p>

        <div className="space-y-4">
          <Collapsible defaultOpen={draftsSorted.length > 0}>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-500/5 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-amber-500/10 dark:border-amber-900/50 dark:bg-amber-950/20">
              <ChevronDown className="h-4 w-4 shrink-0 text-amber-700 transition-transform duration-200 group-data-[state=closed]:-rotate-90 dark:text-amber-400" />
              <Inbox className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>Brouillons</span>
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                {draftsSorted.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className={cn('overflow-x-auto overflow-y-auto max-h-[min(50vh,28rem)] rounded-lg border', listCardBorder, excelTableClass)}>
                <table>
                  {devisTableHead}
                  <tbody>
                    {draftsSorted.length === 0 ? (
                      <tr>
                        <td colSpan={DEVIS_TABLE_COL_COUNT} className="py-8 text-center text-sm text-muted-foreground">
                          Aucun brouillon pour ces filtres.
                        </td>
                      </tr>
                    ) : (
                      draftsSorted.map(renderDevisRow)
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/50">
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <ListChecks className={cn('h-4 w-4 shrink-0', listAccent === 'achat' ? 'text-orange-600' : 'text-emerald-600')} />
              <span>Confirmés et autres statuts</span>
              <span className="text-muted-foreground font-normal text-xs hidden sm:inline">(confirmé, envoyé, accepté…)</span>
              <span className={cn(
                'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
                listAccent === 'achat' ? 'bg-orange-500/15 text-orange-900 dark:text-orange-200' : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
              )}>
                {restSorted.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className={cn('overflow-x-auto overflow-y-auto max-h-[min(50vh,28rem)] rounded-lg border', listCardBorder, excelTableClass)}>
                <table>
                  {devisTableHead}
                  <tbody>
                    {restSorted.length === 0 ? (
                      <tr>
                        <td colSpan={DEVIS_TABLE_COL_COUNT} className="py-8 text-center text-sm text-muted-foreground">
                          Aucun document traité pour ces filtres.
                        </td>
                      </tr>
                    ) : (
                      restSorted.map(renderDevisRow)
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
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

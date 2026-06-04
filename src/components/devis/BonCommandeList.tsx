import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { toast } from 'sonner';
import { FileText, Trash2, Download, Eye, Loader2, Search, X, Plus, Pencil, ShoppingCart, Truck, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BonCommande, UnifiedDocument, UnifiedDocumentLine } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import { ProcurementDialog } from './ProcurementDialog';
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
import { Filter } from 'lucide-react';
import {
  createBonLivraisonFromBonCommandeVente,
  createBonLivraisonFromMultipleBonsCommandeVente,
  fetchBcIdsHavingBonLivraisonVente,
} from '@/services/bonLivraisonService';
import { validateBcMergeForBl } from '@/lib/mergeCommercialDocuments';
import { getBcClientDisplayName, getBcFournisseurDisplayName } from '@/lib/bcListDisplay';
import { fetchBcFournisseurDocumentsAsBonCommande } from '@/lib/bcFournisseurList';
import { Checkbox } from '@/components/ui/checkbox';
import { CommercialAttachmentBadges } from '@/components/shared/CommercialAttachmentBadges';
import { documentService } from '@/services/documentService';
import { sortDevisListRecentFirst } from '@/lib/devisListLayout';
import { documentAuditTableHeadCells, DocumentAuditTableCells } from '@/components/devis/DocumentAuditTableColumns';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { cn } from '@/lib/utils';
import { ACHATS_EXCEL_TABLE_CLASS, VENTES_EXCEL_TABLE_CLASS } from '@/lib/tableStyles';

const BC_TABLE_COL_COUNT = 16;

interface BonCommandeListProps {
  bonsCommande: BonCommande[];
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (bc: BonCommande) => void;
  onDelete: (bc: BonCommande) => void;
  onAdd: () => void;
  onRefresh?: () => void;
  showAddButton?: boolean;
  /** Default filter for BC type (Ventes → vente, Achats → achat). */
  defaultTypeFilter?: 'all' | 'achat' | 'vente';
}

export const BonCommandeList = memo(({ bonsCommande, currentUserId, isAdminOrMod, onEdit, onDelete, onAdd, onRefresh, showAddButton = true, defaultTypeFilter = 'all' }: BonCommandeListProps) => {
  const [deleteConfirm, setDeleteConfirm] = useState<BonCommande | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'achat' | 'vente'>(defaultTypeFilter);
  const [procurementBC, setProcurementBC] = useState<UnifiedDocument | null>(null);
  const [bcIdsWithBl, setBcIdsWithBl] = useState<Set<number>>(new Set());
  const [blBusyId, setBlBusyId] = useState<number | null>(null);
  const [selectedBcIds, setSelectedBcIds] = useState<Set<number>>(new Set());
  const [mergeBlBusy, setMergeBlBusy] = useState(false);
  const [v2BcFournisseurs, setV2BcFournisseurs] = useState<BonCommande[]>([]);

  const loadV2BcFournisseurs = useCallback(async () => {
    if (defaultTypeFilter !== 'achat') {
      setV2BcFournisseurs([]);
      return;
    }
    try {
      const rows = await fetchBcFournisseurDocumentsAsBonCommande();
      setV2BcFournisseurs(rows);
    } catch (e) {
      console.warn('[BonCommandeList] BC fournisseur v2:', e);
      setV2BcFournisseurs([]);
    }
  }, [defaultTypeFilter]);

  useEffect(() => {
    void loadV2BcFournisseurs();
  }, [loadV2BcFournisseurs, bonsCommande]);

  const refreshBcIdsWithBl = useCallback(() => {
    void fetchBcIdsHavingBonLivraisonVente().then((ids) => setBcIdsWithBl(ids));
  }, []);

  useEffect(() => {
    refreshBcIdsWithBl();
  }, [bonsCommande, refreshBcIdsWithBl]);

  useEffect(() => {
    const onBlRefresh = () => refreshBcIdsWithBl();
    window.addEventListener('grosafe:bl-refresh', onBlRefresh);
    return () => window.removeEventListener('grosafe:bl-refresh', onBlRefresh);
  }, [refreshBcIdsWithBl]);

  useEffect(() => {
    setSelectedType(defaultTypeFilter);
  }, [defaultTypeFilter]);

  const startProcurement = useCallback(async (bc: BonCommande) => {
    if (bc.type === 'vente') {
      const already = await documentService.hasLegacyClientBcProcurementFollowups(String(bc.id));
      if (already) {
        const ok = window.confirm(
          'Ce BC client a déjà des BC fournisseur liés. Créer des BC fournisseur supplémentaires ? Le BC client reste dans la liste vente.'
        );
        if (!ok) return;
      }
    }
    // Map legacy BC to UnifiedDocument (Simulated for Procurement flow)
    const unifiedBC: UnifiedDocument = {
      id: bc.id.toString(),
      numero: bc.devis_number,
      type: 'BC_CLIENT',
      status: 'VALIDATED',
      client_id: null,
      fournisseur_id: null,
      parent_id: null,
      notes: bc.notes,
      metadata: {
        legacy_devis_type: bc.type,
        client_name: bc.third_party_name || undefined,
      },
      created_by: bc.created_by,
      created_at: bc.created_at,
      updated_at: bc.updated_at,
      lines: bc.items.map((item, idx) => ({
        id: `legacy-${bc.id}-${idx}`,
        document_id: bc.id.toString(),
        product_id: item.product_id || null,
        quantity: item.quantity,
        unit_price: item.prix_ttc,
        total_price: item.quantity * item.prix_ttc,
        description: item.description,
        created_at: bc.created_at,
        updated_at: bc.updated_at,
        product_name: item.designation,
      })),
      client_name: bc.third_party_name || undefined
    };
    setProcurementBC(unifiedBC);
  }, []);

  const mergedBonsCommande = useMemo(() => {
    if (defaultTypeFilter !== 'achat' && selectedType === 'vente') {
      return bonsCommande;
    }
    if (defaultTypeFilter === 'achat' || selectedType === 'achat') {
      const legacyAchats = bonsCommande.filter((bc) => bc.type === 'achat');
      return [...v2BcFournisseurs, ...legacyAchats];
    }
    return bonsCommande;
  }, [bonsCommande, v2BcFournisseurs, defaultTypeFilter, selectedType]);

  const filteredBC = useMemo(() => {
    let result = mergedBonsCommande;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(bc =>
        bc.devis_number.toLowerCase().includes(term) ||
        bc.third_party_name?.toLowerCase().includes(term) ||
        bc.source_client_name?.toLowerCase().includes(term) ||
        bc.source_bc_number?.toLowerCase().includes(term) ||
        bc.items.some(item => item.designation.toLowerCase().includes(term))
      );
    }
    if (selectedType !== 'all') {
      result = result.filter(bc => bc.type === selectedType);
    }
    return result;
  }, [mergedBonsCommande, searchTerm, selectedType]);

  const bcSorted = useMemo(() => sortDevisListRecentFirst(filteredBC), [filteredBC]);

  const listResetKey = `${searchTerm}|${selectedType}`;
  const {
    slice: bcPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(bcSorted, listResetKey);

  const listAccent = selectedType === 'achat' ? 'achat' : 'vente';
  const excelTableClass = listAccent === 'achat' ? ACHATS_EXCEL_TABLE_CLASS : VENTES_EXCEL_TABLE_CLASS;
  const listCardBorder = listAccent === 'achat' ? 'border-orange-500/25' : 'border-emerald-500/25';

  const toBCPDFData = (bc: BonCommande): DevisPDFData => ({
    devis_number: bc.devis_number,
    devis_date: bc.devis_date,
    type: (bc.type === 'vente' || bc.type === 'sortant') ? 'sortant' : 'entrant',
    third_party_name: bc.third_party_name,
    third_party_address: bc.third_party_address,
    third_party_tax_id: bc.third_party_tax_id,
    third_party_phone: bc.third_party_phone,
    items: bc.items,
    total_amount: bc.total_amount,
    notes: bc.notes,
    is_ttc: bc.is_ttc,
    is_bc: bc.is_bc,
    is_ba: bc.is_ba || false,
  });

  const handlePreview = useCallback(async (bc: BonCommande) => {
    setIsGenerating(bc.id);
    try {
      const url = await getDevisPDFBlobUrl(toBCPDFData(bc));
      setPreviewTitle(`BC ${bc.devis_number}`);
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

  const handleGenerateBl = useCallback(async (bc: BonCommande) => {
    if (bc.type !== 'vente') return;
    if (bcIdsWithBl.has(bc.id)) {
      toast.info('Un bon de livraison existe déjà pour ce BC. Ouvrez Ventes → Bons de Livraison.');
      return;
    }
    const ok = window.confirm(`Créer le bon de livraison à partir du BC ${bc.devis_number} ?`);
    if (!ok) return;
    setBlBusyId(bc.id);
    try {
      const result = await createBonLivraisonFromBonCommandeVente(bc);
      if (result.success) {
        toast.success(`BL ${result.blNumber} créé. Retrouvez-le dans Ventes → Bons de Livraison.`);
        setBcIdsWithBl((prev) => new Set(prev).add(bc.id));
        window.dispatchEvent(new CustomEvent('grosafe:bl-refresh'));
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setBlBusyId(null);
    }
  }, [bcIdsWithBl, onRefresh]);

  const selectedBcList = useMemo(
    () => bonsCommande.filter((bc) => selectedBcIds.has(bc.id)),
    [bonsCommande, selectedBcIds]
  );

  const canMergeBl = defaultTypeFilter === 'vente' || selectedType === 'vente';

  const handleMergeBl = useCallback(async () => {
    const list = selectedBcList.filter((bc) => bc.type === 'vente');
    const check = validateBcMergeForBl(list);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const blocked = list.find((bc) => bcIdsWithBl.has(bc.id));
    if (blocked) {
      toast.error(`Le BC ${blocked.devis_number} a déjà un bon de livraison.`);
      return;
    }
    const numbers = list.map((b) => b.devis_number).join(', ');
    if (!window.confirm(`Fusionner les BC ${numbers} en un seul bon de livraison ?`)) return;

    setMergeBlBusy(true);
    try {
      const result = await createBonLivraisonFromMultipleBonsCommandeVente(list);
      if (result.success) {
        toast.success(`BL ${result.blNumber} créé.`);
        setBcIdsWithBl((prev) => {
          const next = new Set(prev);
          list.forEach((bc) => next.add(bc.id));
          return next;
        });
        setSelectedBcIds(new Set());
        window.dispatchEvent(new CustomEvent('grosafe:bl-refresh'));
        onRefresh?.();
      } else {
        toast.error(result.error);
      }
    } finally {
      setMergeBlBusy(false);
    }
  }, [selectedBcList, bcIdsWithBl, onRefresh]);

  const bcTableHead = (
    <thead>
      <tr className="border-b border-border">
        {canMergeBl && (
          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-10" aria-label="Sélection" />
        )}
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° BC</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Devis source</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fournisseur</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Créé par</th>
        {documentAuditTableHeadCells}
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fichiers</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">PDF</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
      </tr>
    </thead>
  );

  const renderBCRow = (bc: BonCommande) => {
    const totalQty = bc.items.reduce((s, i) => s + i.quantity, 0);
    const generating = isGenerating === bc.id;
    return (
      <tr key={bc.id} className="border-b border-border/50 hover:bg-muted/30">
        {canMergeBl && bc.type === 'vente' && (
          <td className="py-3 px-2">
            <Checkbox
              checked={selectedBcIds.has(bc.id)}
              disabled={bcIdsWithBl.has(bc.id)}
              onCheckedChange={(v) => {
                setSelectedBcIds((prev) => {
                  const next = new Set(prev);
                  if (v === true) next.add(bc.id);
                  else next.delete(bc.id);
                  return next;
                });
              }}
              aria-label={`Sélectionner ${bc.devis_number}`}
            />
          </td>
        )}
        {canMergeBl && bc.type !== 'vente' && <td className="py-3 px-2" />}
        <td className="py-3 px-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            bc.type === 'achat' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
          }`}>
            {bc.type === 'achat' ? '📥 Achat' : '📤 Vente'}
          </span>
        </td>
        <td className="py-3 px-4 text-sm font-medium text-foreground">{bc.devis_number}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{bc.source_devis_number || '-'}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {new Date(bc.devis_date).toLocaleDateString('fr-FR')}
        </td>
        <td className="py-3 px-4 text-sm text-foreground">{getBcClientDisplayName(bc)}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{getBcFournisseurDisplayName(bc)}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{bc.creator_name || '-'}</td>
        <DocumentAuditTableCells doc={bc} />
        <td className="py-3 px-4 text-sm">
          <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-foreground uppercase">
            {bc.status || 'brouillon'}
          </span>
        </td>
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
          <CommercialAttachmentBadges attachments={bc.attachment_urls} />
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePreview(bc)}
              disabled={generating}
              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Prévisualiser PDF"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
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
          <div className="flex items-center gap-2">
            {bc.type === 'vente' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                  title={
                    bcIdsWithBl.has(bc.id)
                      ? 'Bon de livraison déjà créé pour ce BC'
                      : 'Créer le bon de livraison (visible dans Ventes → Bons de Livraison)'
                  }
                  disabled={bcIdsWithBl.has(bc.id) || blBusyId === bc.id}
                  onClick={() => void handleGenerateBl(bc)}
                >
                  {blBusyId === bc.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Truck className="w-3.5 h-3.5" />
                  )}
                  {bcIdsWithBl.has(bc.id) ? 'Livré' : 'BL'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 h-8 px-2.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200/50 transition-all font-bold text-xs"
                  title="Créer directement un ou plusieurs BC fournisseur (sans devis fournisseur)"
                  onClick={() => void startProcurement(bc)}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  BC Fournisseur
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={() => handlePreview(bc)}
              disabled={generating}
              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Prévisualiser PDF"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            </button>
            {!bc.document_v2_id && (
              <button
                type="button"
                onClick={() => onEdit(bc)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Modifier"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Modif</span>
              </button>
            )}
            {!bc.document_v2_id && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(bc)}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (mergedBonsCommande.length === 0) {
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
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-foreground">Mes Bons de Commande</h3>
            {showAddButton && (
              <Button onClick={onAdd} size="sm" className="h-8 gap-2">
                <Plus className="w-4 h-4" />
                Ajouter BC
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
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
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="achat">📥 Achat</SelectItem>
                <SelectItem value="vente">📤 Vente</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredBC.length} BC</span>
            {canMergeBl && selectedBcIds.size >= 2 && (
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={mergeBlBusy}
                onClick={() => void handleMergeBl()}
              >
                {mergeBlBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitMerge className="w-4 h-4" />
                )}
                Fusionner en 1 BL ({selectedBcIds.size})
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Tous les bons de commande dans une seule liste (plus récent en haut), 10 par page.
        </p>

        <div className={cn('overflow-x-auto rounded-lg border', listCardBorder, excelTableClass)}>
          <table className="w-full">
            {bcTableHead}
            <tbody>
              {bcSorted.length === 0 ? (
                <tr>
                  <td colSpan={BC_TABLE_COL_COUNT} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun BC pour ces filtres.
                  </td>
                </tr>
              ) : (
                bcPage.map(renderBCRow)
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le BC {deleteConfirm?.devis_number} sera supprimé définitivement.
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
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={`${previewUrl}#toolbar=0`} className="h-[75vh] w-full border rounded-lg bg-muted/30" title="Aperçu BC" />
          )}
        </DialogContent>
      </Dialog>

      <ProcurementDialog
        open={!!procurementBC}
        onOpenChange={(open) => !open && setProcurementBC(null)}
        sourceBC={procurementBC}
        targetDocType="BC_FOURNISSEUR"
        onSuccess={() => {
          void loadV2BcFournisseurs();
          onRefresh?.();
          toast.success("Approvisionnement lancé avec succès.");
        }}
      />
    </>
  );
});

BonCommandeList.displayName = 'BonCommandeList';

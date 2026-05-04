import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { toast } from 'sonner';
import { FileText, Trash2, Download, Eye, Loader2, Search, X, Plus, Pencil, ShoppingCart, ChevronDown, Receipt, Inbox, ListChecks } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createFactureFromBonCommandeVente, fetchBcIdsHavingFactureVente } from '@/services/factureService';
import { documentService } from '@/services/documentService';
import { partitionDraftsAndRest, sortDevisListRecentFirst } from '@/lib/devisListLayout';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [procurementTargetDocType, setProcurementTargetDocType] = useState<'DEVIS_FOURNISSEUR' | 'BC_FOURNISSEUR'>('DEVIS_FOURNISSEUR');
  const [bcIdsWithFacture, setBcIdsWithFacture] = useState<Set<number>>(new Set());
  const [factureBusyId, setFactureBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBcIdsHavingFactureVente().then((ids) => {
      if (!cancelled) setBcIdsWithFacture(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [bonsCommande]);

  useEffect(() => {
    setSelectedType(defaultTypeFilter);
  }, [defaultTypeFilter]);

  const startProcurement = useCallback(async (bc: BonCommande, targetDocType: 'DEVIS_FOURNISSEUR' | 'BC_FOURNISSEUR') => {
    if (bc.type === 'vente') {
      const already = await documentService.hasLegacyClientBcProcurementFollowups(String(bc.id));
      if (already) {
        const ok = window.confirm(
          'Ce BC vente a déjà été converti en approvisionnement fournisseur. Poursuivre va créer des devis/BC fournisseur supplémentaires et ajouter une nouvelle entrée dans les notes du BC (le type reste achat). Continuer ?'
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
      metadata: { legacy_devis_type: bc.type },
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
    setProcurementTargetDocType(targetDocType);
    setProcurementBC(unifiedBC);
  }, []);

  const filteredBC = useMemo(() => {
    let result = bonsCommande;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(bc =>
        bc.devis_number.toLowerCase().includes(term) ||
        bc.third_party_name?.toLowerCase().includes(term) ||
        bc.items.some(item => item.designation.toLowerCase().includes(term))
      );
    }
    if (selectedType !== 'all') {
      result = result.filter(bc => bc.type === selectedType);
    }
    return result;
  }, [bonsCommande, searchTerm, selectedType]);

  const { draftsSorted, restSorted } = useMemo(() => {
    const sorted = sortDevisListRecentFirst(filteredBC);
    const { drafts, rest } = partitionDraftsAndRest(sorted);
    return { draftsSorted: drafts, restSorted: rest };
  }, [filteredBC]);

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

  const handleGenerateFacture = useCallback(async (bc: BonCommande) => {
    if (bc.type !== 'vente') return;
    if (bcIdsWithFacture.has(bc.id)) {
      toast.info('Une facture existe déjà pour ce BC. Ouvrez Ventes → Factures.');
      return;
    }
    const ok = window.confirm(`Générer la facture de vente à partir du BC ${bc.devis_number} ?`);
    if (!ok) return;
    setFactureBusyId(bc.id);
    try {
      const result = await createFactureFromBonCommandeVente(bc);
      if (result.success) {
        toast.success(`Facture ${result.numero} créée. Retrouvez-la dans Ventes → Factures.`);
        setBcIdsWithFacture((prev) => new Set(prev).add(bc.id));
        window.dispatchEvent(new CustomEvent('grosafe:factures-refresh'));
      } else {
        toast.error(result.error);
      }
    } finally {
      setFactureBusyId(null);
    }
  }, [bcIdsWithFacture]);

  const bcTableHead = (
    <thead>
      <tr className="border-b border-border">
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° BC</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Devis Source</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tiers</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Créé par</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
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
        <td className="py-3 px-4 text-sm text-foreground">{bc.third_party_name || '-'}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{bc.creator_name || '-'}</td>
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
                    bcIdsWithFacture.has(bc.id)
                      ? 'Facture déjà générée pour ce BC'
                      : 'Générer la facture de vente (visible dans Ventes → Factures)'
                  }
                  disabled={bcIdsWithFacture.has(bc.id) || factureBusyId === bc.id}
                  onClick={() => void handleGenerateFacture(bc)}
                >
                  {factureBusyId === bc.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Receipt className="w-3.5 h-3.5" />
                  )}
                  {bcIdsWithFacture.has(bc.id) ? 'Facturé' : 'Facture'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 h-8 px-2.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200/50 transition-all font-bold text-xs"
                      title="Convertir vers achats"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Convertir
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => { void startProcurement(bc, 'DEVIS_FOURNISSEUR'); }}>
                      Créer Devis Fournisseur
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { void startProcurement(bc, 'BC_FOURNISSEUR'); }}>
                      Créer BC Fournisseur
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <button
              type="button"
              onClick={() => onEdit(bc)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Modifier"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Modif</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(bc)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

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
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Brouillons séparés des autres statuts ; le plus récent en haut dans chaque groupe.
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
              <div className="overflow-x-auto overflow-y-auto max-h-[min(50vh,28rem)] rounded-lg border border-border">
                <table className="w-full">
                  {bcTableHead}
                  <tbody>
                    {draftsSorted.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                          Aucun brouillon pour ces filtres.
                        </td>
                      </tr>
                    ) : (
                      draftsSorted.map(renderBCRow)
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/50">
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <ListChecks className="h-4 w-4 shrink-0 text-primary" />
              <span>Confirmés et autres statuts</span>
              <span className="text-muted-foreground font-normal text-xs hidden sm:inline">(confirmé, envoyé, accepté…)</span>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {restSorted.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="overflow-x-auto overflow-y-auto max-h-[min(50vh,28rem)] rounded-lg border border-border">
                <table className="w-full">
                  {bcTableHead}
                  <tbody>
                    {restSorted.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                          Aucun BC traité pour ces filtres.
                        </td>
                      </tr>
                    ) : (
                      restSorted.map(renderBCRow)
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
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
        targetDocType={procurementTargetDocType}
        onSuccess={() => {
          onRefresh?.();
          toast.success("Approvisionnement lancé avec succès.");
        }}
      />
    </>
  );
});

BonCommandeList.displayName = 'BonCommandeList';

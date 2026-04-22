import { useState, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import { FileText, Trash2, Download, Eye, Loader2, Search, X, FilePlus, Plus, Edit, Pencil, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BonCommande, UnifiedDocument, UnifiedDocumentLine } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';
import { downloadDevisPDF, getDevisPDFBlobUrl, DevisPDFData } from '@/utils/pdfGenerator';
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

interface BonCommandeListProps {
  bonsCommande: BonCommande[];
  currentUserId: string | null;
  isAdminOrMod: boolean;
  onEdit: (bc: BonCommande) => void;
  onDelete: (bc: BonCommande) => void;
  onAdd: () => void;
  onRefresh?: () => void;
}

const ITEMS_PER_PAGE = 10;

export const BonCommandeList = memo(({ bonsCommande, currentUserId, isAdminOrMod, onEdit, onDelete, onAdd, onRefresh }: BonCommandeListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<BonCommande | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'entrant' | 'sortant'>('all');
  const [procurementBC, setProcurementBC] = useState<UnifiedDocument | null>(null);

  const startProcurement = useCallback((bc: BonCommande) => {
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
      metadata: {},
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

  const paginatedBC = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBC.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBC, currentPage]);

  const totalPages = Math.ceil(filteredBC.length / ITEMS_PER_PAGE);

  const toBCPDFData = (bc: BonCommande): DevisPDFData => ({
    devis_number: bc.devis_number,
    devis_date: bc.devis_date,
    type: bc.type,
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
            <Button onClick={onAdd} size="sm" className="h-8 gap-2">
              <Plus className="w-4 h-4" />
              Ajouter BC
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
            <Select value={selectedType} onValueChange={v => { setSelectedType(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-32 bg-background">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="entrant">📥 Entrant</SelectItem>
                <SelectItem value="sortant">📤 Sortant</SelectItem>
              </SelectContent>
            </Select>
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
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{bc.devis_number}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{bc.source_devis_number || '-'}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(bc.devis_date).toLocaleDateString('fr-FR')}
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
                      <div className="flex items-center gap-2">
                        {bc.type === 'sortant' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startProcurement(bc)}
                            className="flex items-center gap-1.5 h-8 px-2.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200/50 transition-all font-bold text-xs"
                            title="Lancer l'approvisionnement"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Appros
                          </Button>
                        )}
                        <button
                          onClick={() => handlePreview(bc)}
                          disabled={generating}
                          className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Prévisualiser PDF"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => onEdit(bc)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Modif</span>
                        </button>
                        <button
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

      <ProcurementDialog 
        open={!!procurementBC} 
        onOpenChange={(open) => !open && setProcurementBC(null)}
        sourceBC={procurementBC}
        onSuccess={() => {
          onRefresh?.();
          toast.success("Approvisionnement lancé avec succès.");
        }}
      />
    </>
  );
});

BonCommandeList.displayName = 'BonCommandeList';

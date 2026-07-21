import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { Download, Eye, FileText, Loader2, Printer, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDocument, UnifiedDocumentType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { enrichUnifiedDocumentDisplay } from '@/lib/unifiedDocumentDisplay';
import {
  downloadUnifiedDocumentPDF,
  getUnifiedDocumentPDFBlob,
  printUnifiedDocument,
  printUnifiedDocuments,
} from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import {
  ensureSupabaseSessionReady,
  SESSION_EXPIRED_USER_MESSAGE,
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';
import { cn } from '@/lib/utils';

const WAREHOUSE_DOC_TYPES: UnifiedDocumentType[] = ['BE', 'BS', 'BL_CLIENT', 'BL_FOURNISSEUR'];

type TypeFilter = 'all' | 'BE' | 'BS' | 'BL_CLIENT' | 'BL_FOURNISSEUR';

const TYPE_LABELS: Record<UnifiedDocumentType, string> = {
  DEMANDE_ACHAT: "Demande d'achat",
  BC_CLIENT: 'BC client',
  DEVIS_FOURNISSEUR: 'Devis fournisseur',
  BC_FOURNISSEUR: 'BC fournisseur',
  BL_FOURNISSEUR: 'BL fournisseur (envoi)',
  BE: "Bon d'entrée",
  BS: 'Bon de sortie',
  BL_CLIENT: 'Bon de livraison',
  FACTURE: 'Facture',
};

const TYPE_BADGE_CLASS: Partial<Record<UnifiedDocumentType, string>> = {
  BE: 'bg-success/10 text-success border-success/20',
  BS: 'bg-destructive/10 text-destructive border-destructive/20',
  BL_CLIENT: 'bg-primary/10 text-primary border-primary/20',
  BL_FOURNISSEUR: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
};

function formatDocDate(doc: UnifiedDocument): string {
  const meta = doc.metadata as Record<string, unknown> | undefined;
  const raw = (meta?.document_date as string) || doc.created_at;
  return formatAppDate(raw);
}

export function WarehouseDocumentsReports() {
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [printing, setPrinting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<UnifiedDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) {
        toast.error(SESSION_EXPIRED_USER_MESSAGE);
        setDocuments([]);
        return;
      }

      const { data, error } = await supabaseQueryWithAuthRetry(() =>
        supabase
          .from('documents')
          .select(
            `
            *,
            fournisseurs(nom),
            clients(nom),
            document_lines(
              *,
              products(name, sku)
            )
          `
          )
          .in('type', WAREHOUSE_DOC_TYPES)
          .order('created_at', { ascending: false })
          .limit(500)
      );

      if (error) throw error;

      const enriched = (data ?? []).map((row) =>
        enrichUnifiedDocumentDisplay(row as unknown as UnifiedDocument)
      );
      setDocuments(enriched);
    } catch (err) {
      console.error('[WarehouseDocumentsReports] load failed:', err);
      toast.error('Impossible de charger les documents magasin');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useSessionResumeReload(loadDocuments);
  useCompanyChangeReload(loadDocuments);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return documents.filter((doc) => {
      if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
      if (!query) return true;
      return (
        doc.numero.toLowerCase().includes(query) ||
        doc.fournisseur_name?.toLowerCase().includes(query) ||
        doc.client_name?.toLowerCase().includes(query)
      );
    });
  }, [documents, searchTerm, typeFilter]);

  const counts = useMemo(
    () => ({
      all: documents.length,
      BE: documents.filter((d) => d.type === 'BE').length,
      BS: documents.filter((d) => d.type === 'BS').length,
      BL_CLIENT: documents.filter((d) => d.type === 'BL_CLIENT').length,
      BL_FOURNISSEUR: documents.filter((d) => d.type === 'BL_FOURNISSEUR').length,
    }),
    [documents]
  );

  const handlePreview = async (doc: UnifiedDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    try {
      const blob = await getUnifiedDocumentPDFBlob(doc);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      toast.error('Impossible de générer l\'aperçu PDF');
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handlePrintOne = async (doc: UnifiedDocument) => {
    try {
      await printUnifiedDocument(doc);
    } catch {
      toast.error(`Impossible d'imprimer ${doc.numero}`);
    }
  };

  const handlePrintAll = async () => {
    if (filteredDocs.length === 0) return;
    setPrinting(true);
    try {
      toast.info(`Impression de ${filteredDocs.length} document(s)…`);
      await printUnifiedDocuments(filteredDocs);
      toast.success('Documents envoyés à l\'impression');
    } catch {
      toast.error('Erreur lors de l\'impression groupée');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadAll = async () => {
    if (filteredDocs.length === 0) return;
    try {
      for (const doc of filteredDocs) {
        await downloadUnifiedDocumentPDF(doc);
      }
      toast.success(`${filteredDocs.length} PDF téléchargé(s)`);
    } catch {
      toast.error('Erreur lors du téléchargement groupé');
    }
  };

  const filterButtons: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: `Tous (${counts.all})` },
    { id: 'BE', label: `Entrées (${counts.BE})` },
    { id: 'BS', label: `Sorties (${counts.BS})` },
    { id: 'BL_CLIENT', label: `Livraisons (${counts.BL_CLIENT})` },
    { id: 'BL_FOURNISSEUR', label: `BL four. (${counts.BL_FOURNISSEUR})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Documents Magasin</h3>
          <p className="text-sm text-muted-foreground">
            Bons d&apos;entrée, de sortie, livraisons client et BL fournisseur (façonnage) — aperçu, impression et téléchargement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={filteredDocs.length === 0 || printing}
            onClick={() => void handlePrintAll()}
          >
            {printing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimer tout
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={filteredDocs.length === 0}
            onClick={() => void handleDownloadAll()}
          >
            <Download className="h-4 w-4" />
            Télécharger tout
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setTypeFilter(btn.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === btn.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher n°, client, fournisseur…"
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des documents…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Aucun document enregistré pour ce filtre.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">N°</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tiers</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Articles</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn('font-normal', TYPE_BADGE_CLASS[doc.type])}
                      >
                        {TYPE_LABELS[doc.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{doc.numero}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDocDate(doc)}</td>
                    <td className="px-4 py-3 text-foreground">
                      {doc.fournisseur_name || doc.client_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.lines?.length ?? 0} article{(doc.lines?.length ?? 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Aperçu"
                          onClick={() => void handlePreview(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Imprimer"
                          onClick={() => void handlePrintOne(doc)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Télécharger PDF"
                          onClick={() => void downloadUnifiedDocumentPDF(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col">
          <DialogHeader>
            <DialogTitle>
              {previewDoc ? `${TYPE_LABELS[previewDoc.type]} — ${previewDoc.numero}` : 'Aperçu'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Aperçu PDF du document magasin sélectionné.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {loadingPreview ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Génération du PDF…
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-full w-full rounded border border-border"
                title="Aperçu document magasin"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAppDate } from '@/lib/formatAppDate';
import { ArrowLeft, Download, Eye, Loader2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommercialAttachmentBadges } from '@/components/shared/CommercialAttachmentBadges';
import { COMMERCIAL_DOC_KIND_LABELS, classifyCommercialDoc } from '@/lib/commercialDocKind';
import { computeDevisLine, computeDevisTotals } from '@/lib/devisPricing';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import { loadBossDocumentDetail } from '@/services/bossCommercialService';
import {
  buildDocumentPdfFileName,
  downloadDevisPDF,
  getDevisPDFBlobUrl,
  type DevisPDFData,
} from '@/utils/pdfGenerator';
import type { Devis } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const KIND_BADGE_CLASS: Record<string, string> = {
  DEVIS_CLIENT: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  DEVIS_FOURNISSEUR: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  BC_CLIENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  BC_FOURNISSEUR: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
};

function toBossPdfData(d: Devis): DevisPDFData {
  return {
    devis_number: d.devis_number,
    devis_date: d.devis_date,
    type: d.type === 'vente' || d.type === 'sortant' ? 'sortant' : 'entrant',
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
  };
}

function documentTitle(d: Devis): string {
  if (d.is_bc) return `BC ${d.devis_number}`;
  return `Devis ${d.devis_number}`;
}

export function BossDocumentDetail() {
  const { userId, docId } = useParams<{ userId: string; docId: string }>();
  const [searchParams] = useSearchParams();
  const { currentCompanyId, loading: companyLoading } = useAppCompany();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<Devis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const parsedDocId = Number(docId);

  const load = useCallback(async () => {
    if (!currentCompanyId || !Number.isFinite(parsedDocId)) {
      setDoc(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const row = await loadBossDocumentDetail(currentCompanyId, parsedDocId);
      setDoc(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${message}`);
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, parsedDocId]);

  useEffect(() => {
    if (companyLoading) return;
    void load();
  }, [companyLoading, load]);

  const kind = useMemo(() => (doc ? classifyCommercialDoc(doc) : 'OTHER'), [doc]);
  const totals = useMemo(
    () => (doc ? computeDevisTotals(doc.items, false) : null),
    [doc]
  );

  const backHref = useMemo(() => {
    const q = searchParams.toString();
    if (userId) return q ? `/boss/employee/${userId}?${q}` : `/boss/employee/${userId}`;
    return q ? `/boss?${q}` : '/boss';
  }, [searchParams, userId]);

  const openPdfPreview = useCallback(async () => {
    if (!doc) return;
    setPdfBusy(true);
    try {
      const pdfData = toBossPdfData(doc);
      const url = await getDevisPDFBlobUrl(pdfData);
      setPreviewTitle(documentTitle(doc));
      setPreviewDownloadName(buildDocumentPdfFileName(pdfData));
      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de générer le PDF');
    } finally {
      setPdfBusy(false);
    }
  }, [doc]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    setPdfBusy(true);
    try {
      await downloadDevisPDF(toBossPdfData(doc));
    } catch (err) {
      console.error(err);
      toast.error('Impossible de télécharger le PDF');
    } finally {
      setPdfBusy(false);
    }
  }, [doc]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
    setPreviewDownloadName('');
  }, [previewUrl]);

  const dateLabel = doc
    ? formatAppDate(doc.devis_date)
    : '';

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-8">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
        <Link to={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Link>
      </Button>

      {loading || companyLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !doc ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Document introuvable.</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{documentTitle(doc)}</h2>
                <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
              </div>
              <Badge className={KIND_BADGE_CLASS[kind] ?? ''} variant="outline">
                {COMMERCIAL_DOC_KIND_LABELS[kind]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline" className="capitalize font-normal">
                {doc.status}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'font-normal',
                  doc.is_ttc
                    ? 'border-primary/30 text-primary'
                    : 'border-amber-500/30 text-amber-800 dark:text-amber-200'
                )}
              >
                {doc.is_ttc ? 'TTC' : 'HT'}
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tiers</p>
                <p className="font-medium">{doc.third_party_name || '—'}</p>
              </div>
              {doc.third_party_phone && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Téléphone</p>
                  <p>{doc.third_party_phone}</p>
                </div>
              )}
              {doc.third_party_tax_id && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Matricule fiscale</p>
                  <p>{doc.third_party_tax_id}</p>
                </div>
              )}
              {doc.third_party_address && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Adresse</p>
                  <p className="whitespace-pre-wrap">{doc.third_party_address}</p>
                </div>
              )}
              {doc.creator_name && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Créé par</p>
                  <p>{doc.creator_name}</p>
                </div>
              )}
              {doc.notes?.trim() && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{doc.notes}</p>
                </div>
              )}
              {doc.attachment_urls && doc.attachment_urls.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Pièces jointes</p>
                  <CommercialAttachmentBadges attachments={doc.attachment_urls} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pdfBusy} onClick={() => void openPdfPreview()}>
              {pdfBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Voir PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pdfBusy}
              onClick={() => void handleDownload()}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </Button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Articles ({doc.items.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[32rem] text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Désignation</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Qté</th>
                    {doc.type === 'vente' && (
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Prix achat</th>
                    )}
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">P.U HT</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Sous-total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, idx) => {
                    const line = computeDevisLine(item, false);
                    return (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-2 font-medium">{item.designation}</td>
                        <td className="px-2 py-2 text-right">{item.quantity}</td>
                        {doc.type === 'vente' && (
                          <td className="px-2 py-2 text-right text-muted-foreground">
                            {item.prix_achat != null && item.prix_achat > 0
                              ? `${item.prix_achat.toFixed(3)}`
                              : '—'}
                          </td>
                        )}
                        <td className="px-2 py-2 text-right">{line.unitHT.toFixed(3)}</td>
                        <td className="px-2 py-2 text-right font-medium">{line.lineTTC.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2">
                      <td
                        colSpan={doc.type === 'vente' ? 5 : 4}
                        className="px-2 py-2 text-right text-muted-foreground"
                      >
                        Total TTC
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {totals.totalFinal.toFixed(3)} TND
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-2">
            <DialogTitle>{previewTitle}</DialogTitle>
            {previewUrl && (
              <a href={previewUrl} download={previewDownloadName || `${previewTitle}.pdf`}>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl && (
              <iframe
                ref={previewIframeRef}
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                className="h-[75vh] w-full rounded-lg border bg-muted/30"
                title="Prévisualisation PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

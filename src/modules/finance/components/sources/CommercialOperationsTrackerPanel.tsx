import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import { documentService } from '@/services/documentService';
import {
  generateOfficialPDF,
  getDevisPDFBlobUrl,
  type DevisPDFData,
  type DocumentType,
} from '@/utils/pdfGenerator';
import type { UnifiedDocument } from '@/types';
import {
  fetchCommercialOperations,
  filterOperations,
  operationsSummary,
  OPERATION_STEP_ORDER,
  type OperationsFilter,
} from '../../services/commercialOperationsTracker';
import type {
  CommercialOperation,
  OperationStep,
  OperationStepRef,
} from '../../types/commercialOperations';
import {
  OPERATION_STEP_LABELS,
  stepStatusBadgeClass,
  stepStatusLabel,
} from '../../types/commercialOperations';

interface CommercialOperationsTrackerPanelProps {
  companyId: string;
}

const STEP_ICONS: Record<string, ElementType> = {
  devis_client: ClipboardList,
  bc_client: FileText,
  bc_fournisseur: Truck,
  facture_fournisseur: Receipt,
  bl_vente: Package,
  facture_client: Receipt,
};

function toDevisPdfFromRow(row: Record<string, unknown>, overrides?: Partial<DevisPDFData>): DevisPDFData {
  const typeRaw = String(row.type ?? 'vente');
  return {
    devis_number: String(row.devis_number ?? ''),
    devis_date: String(row.devis_date ?? ''),
    type: typeRaw === 'vente' || typeRaw === 'sortant' ? 'sortant' : 'entrant',
    third_party_name: (row.third_party_name as string | null) ?? null,
    third_party_address: (row.third_party_address as string | null) ?? null,
    third_party_tax_id: (row.third_party_tax_id as string | null) ?? null,
    third_party_phone: (row.third_party_phone as string | null) ?? null,
    items: (row.items as DevisPDFData['items']) ?? [],
    total_amount: Number(row.total_amount) || 0,
    notes: (row.notes as string | null) ?? null,
    is_ttc: Boolean(row.is_ttc),
    is_bc: Boolean(row.is_bc),
    is_ba: Boolean(row.is_ba),
    ...overrides,
  };
}

async function unifiedDocumentBlobUrl(doc: UnifiedDocument): Promise<string> {
  const typeMap: Record<string, DocumentType> = {
    BC_FOURNISSEUR: 'bon_entree',
    BE: 'bon_entree',
    BL_FOURNISSEUR: 'bon_entree',
    BS: 'bon_sortie',
    BL_CLIENT: 'bon_livraison',
    BC_CLIENT: 'bon_livraison',
    FACTURE: 'bon_livraison',
  };
  const docType = typeMap[doc.type] || 'bon_livraison';
  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const pdfDoc = (await generateOfficialPDF(
    {
      docType,
      docNumber: doc.numero,
      docDate: String(meta.document_date ?? doc.created_at ?? ''),
      docValidity: String(meta.validity ?? ''),
      transportRef: String(meta.transport_ref ?? ''),
      thirdPartyName: String(
        doc.fournisseur_name ?? doc.client_name ?? meta.third_party_name ?? ''
      ),
      thirdPartyAddress: String(meta.third_party_address ?? ''),
      thirdPartyTaxId: String(meta.third_party_tax_id ?? ''),
      docItems: (doc.lines ?? []).map((l) => ({
        product_id: l.product_id || 0,
        ref: '',
        designation: l.description || 'Produit',
        description: l.description || '',
        quantity: l.quantity,
        price: l.unit_price,
        total: l.total_price,
      })),
    },
    { returnBlob: true }
  )) as import('jspdf').jsPDF;
  const buffer = pdfDoc.output('arraybuffer');
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

function TimelineStep({
  step,
  index,
  activeIndex,
  onPreview,
  previewBusy,
}: {
  step: OperationStep;
  index: number;
  activeIndex: number;
  onPreview: (ref: OperationStepRef) => void;
  previewBusy: string | null;
}) {
  const Icon = STEP_ICONS[step.key] ?? FileText;
  const completed = step.status === 'done';
  const active = index === activeIndex && !completed;
  const busyKey = step.ref ? `${step.ref.module}-${step.ref.id}` : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 relative flex-1 min-w-[72px]',
        completed ? 'text-green-600' : active ? 'text-blue-600' : step.status === 'missing' ? 'text-red-400' : 'text-muted-foreground/50'
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center border-2 z-10 bg-background transition-all',
          completed && 'border-green-600 bg-green-50',
          active && 'border-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.25)]',
          step.status === 'missing' && !completed && 'border-red-200',
          !completed && !active && step.status !== 'missing' && 'border-muted/30'
        )}
      >
        {completed ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Icon className={cn('w-4 h-4', active && 'animate-pulse')} />
        )}
      </div>
      <p className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight px-0.5">
        {OPERATION_STEP_LABELS[step.key]}
      </p>
      <Badge variant="outline" className={cn('h-4 text-[8px] px-1', stepStatusBadgeClass(step.status))}>
        {stepStatusLabel(step.status)}
      </Badge>
      {step.ref && (
        <div className="flex flex-col items-center gap-0.5 mt-0.5">
          <span className="text-[9px] font-mono text-foreground truncate max-w-[80px]" title={step.ref.numero}>
            {step.ref.numero}
          </span>
          {step.ref.module !== 'finance' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={previewBusy === busyKey}
              onClick={() => onPreview(step.ref!)}
              title="Aperçu PDF"
            >
              {previewBusy === busyKey ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      )}
      {step.hint && (
        <span className="text-[8px] text-amber-600 text-center leading-tight px-1" title={step.hint}>
          {step.hint}
        </span>
      )}
    </div>
  );
}

export function CommercialOperationsTrackerPanel({ companyId }: CommercialOperationsTrackerPanelProps) {
  const [operations, setOperations] = useState<CommercialOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OperationsFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCommercialOperations(companyId);
      setOperations(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      toast.error('Impossible de charger le suivi des opérations', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filterOperations(operations, {
        search,
        statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [operations, search, statusFilter, dateFrom, dateTo]
  );

  const summary = useMemo(() => operationsSummary(filtered), [filtered]);

  const handlePreview = useCallback(async (ref: OperationStepRef) => {
    const busyKey = `${ref.module}-${ref.id}`;
    setPreviewBusy(busyKey);
    try {
      if (ref.module === 'finance') {
        toast.info('Facture Finance', {
          description: `Consultez « Facturation › Factures achat » pour ${ref.numero}.`,
        });
        return;
      }

      let url: string;
      if (ref.module === 'devis' || ref.module === 'factures') {
        const row = ref.previewPayload as Record<string, unknown>;
        const pdfData = toDevisPdfFromRow(row, {
          is_bc: ref.module === 'devis' ? Boolean(row.is_bc) : false,
          is_facture: ref.module === 'factures',
          devis_number: ref.numero,
          date_echeance: ref.module === 'factures' ? String(row.date_echeance ?? '') : undefined,
        });
        url = await getDevisPDFBlobUrl(pdfData);
      } else {
        const doc = await documentService.getDocument(ref.id);
        if (!doc) throw new Error('Document introuvable');
        url = await unifiedDocumentBlobUrl(doc);
      }
      setPreviewTitle(ref.numero);
      setPreviewUrl(url);
    } catch (e: unknown) {
      toast.error('Aperçu PDF impossible', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPreviewBusy(null);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  }, [previewUrl]);

  function firstActiveStepIndex(steps: OperationStep[]): number {
    const idx = steps.findIndex((s) => s.status !== 'done');
    return idx >= 0 ? idx : steps.length - 1;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-base">Suivi des opérations commerciales</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Opérations Grosafe (Ventes / Achats / Magasin) — lecture seule. Chaîne : Devis client → BC
            client → BC fournisseur → Facture fournisseur → BL vente → Facture client.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total opérations', value: summary.total, className: 'text-foreground' },
          { label: 'Terminées (6/6)', value: summary.complete, className: 'text-green-600' },
          { label: 'En cours', value: summary.inProgress, className: 'text-blue-600' },
          { label: 'Sans avancement', value: summary.blocked, className: 'text-amber-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground font-medium">{kpi.label}</p>
              <p className={cn('text-2xl font-bold mt-1', kpi.className)}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Client, N° BC ou devis…"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OperationsFilter)}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="incomplete">Incomplètes</SelectItem>
            <SelectItem value="complete">Terminées</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-9 w-full sm:w-[140px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Date début"
        />
        <Input
          type="date"
          className="h-9 w-full sm:w-[140px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Date fin"
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Aucune opération ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((op) => {
            const activeIdx = firstActiveStepIndex(op.steps);
            const progressWidth =
              op.completedSteps <= 1 ? 0 : ((op.completedSteps - 1) / (OPERATION_STEP_ORDER.length - 1)) * 80;

            return (
              <Card key={op.bcClientId} className="overflow-hidden border-l-4 border-l-primary">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="p-4 bg-muted/5 min-w-[180px] border-b lg:border-b-0 lg:border-r border-muted/20 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px]">
                          BC CLIENT
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(op.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <h4 className="font-bold">{op.bcNumero}</h4>
                      <p className="text-sm text-muted-foreground truncate">{op.clientName}</p>
                      {op.devisClientNumero && (
                        <p className="text-[10px] text-muted-foreground mt-1">Devis : {op.devisClientNumero}</p>
                      )}
                    </div>

                    <div className="flex-1 p-4 relative overflow-x-auto">
                      <div className="absolute top-[38px] left-[8%] right-[8%] h-[2px] bg-muted/25 hidden sm:block" />
                      <div
                        className="absolute top-[38px] left-[8%] h-[2px] bg-green-500 transition-all hidden sm:block"
                        style={{ width: `${progressWidth}%` }}
                      />
                      <div className="flex items-start justify-between gap-1 min-w-[520px]">
                        {op.steps.map((step, i) => (
                          <TimelineStep
                            key={step.key}
                            step={step}
                            index={i}
                            activeIndex={activeIdx}
                            onPreview={handlePreview}
                            previewBusy={previewBusy}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="p-4 border-t lg:border-t-0 lg:border-l border-muted/20 min-w-[120px] flex items-center justify-center bg-muted/5">
                      <div className="text-center">
                        <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Avancement</p>
                        <Badge className={cn(op.isComplete ? 'bg-green-600' : 'bg-blue-600')}>
                          {op.isComplete ? 'Terminé' : `${op.completionPercent}%`}
                        </Badge>
                        <p className="text-[9px] text-muted-foreground mt-1">
                          {op.completedSteps}/6 étapes
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className={pdfPreviewDialogContentClassName}>
          <DialogHeader>
            <DialogTitle>Aperçu — {previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} title={previewTitle} className="w-full flex-1 min-h-[60vh] rounded border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

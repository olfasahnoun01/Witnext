import { useCallback, useRef, useState } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { FileUp, Loader2, ScanLine, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DevisFormSection } from './DevisFormUi';
import {
  importBcFournisseurFromFile,
  type BcFournisseurPdfImportResult,
  type FournisseurRef,
} from '@/lib/devisPdfImport';

type Props = {
  fournisseurs: FournisseurRef[];
  targetDocType: 'devis' | 'bc';
  disabled?: boolean;
  existingItemCount?: number;
  onApply: (result: BcFournisseurPdfImportResult) => void;
};

const COPY = {
  devis: {
    title: 'Lecteur devis fournisseur',
    description:
      'Importez le devis PDF (ou photo) du fournisseur pour préremplir le devis achat : fournisseur, date et lignes articles.',
    replaceConfirm:
      'Remplacer les lignes actuelles du devis par celles extraites du PDF ?',
    applyLabel: 'Remplir le devis',
  },
  bc: {
    title: 'Lecteur BC fournisseur',
    description:
      'Importez le devis PDF (ou photo) du fournisseur pour préremplir le bon de commande : fournisseur, date et lignes articles.',
    replaceConfirm:
      'Remplacer les lignes actuelles du BC par celles extraites du PDF ?',
    applyLabel: 'Remplir le BC',
  },
} as const;

export function BcFournisseurPdfReader({
  fournisseurs,
  targetDocType,
  disabled,
  existingItemCount = 0,
  onApply,
}: Props) {
  const copy = COPY[targetDocType];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [preview, setPreview] = useState<BcFournisseurPdfImportResult | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        toast.error('Formats acceptés : PDF ou image (JPG, PNG).');
        return;
      }

      setIsProcessing(true);
      setOcrProgress(0);
      setPreview(null);

      try {
        const result = await importBcFournisseurFromFile(
          file,
          fournisseurs,
          (p) => setOcrProgress(Math.round(p * 100))
        );
        setPreview(result);
        const matched = result.lines.filter((l) => l.matched).length;
        toast.success(
          `${result.lines.length} ligne(s) détectée(s) — ${matched} reliée(s) au catalogue`
        );
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : 'Impossible d\'analyser le document fournisseur'
        );
      } finally {
        setIsProcessing(false);
        setOcrProgress(0);
      }
    },
    [fournisseurs]
  );

  const handleApply = useCallback(() => {
    if (!preview) return;
    if (existingItemCount > 0) {
      const ok = window.confirm(copy.replaceConfirm);
      if (!ok) return;
    }
    onApply(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [preview, existingItemCount, onApply, copy.replaceConfirm]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || isProcessing) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [disabled, isProcessing, processFile]
  );

  return (
    <DevisFormSection
      title={copy.title}
      description={copy.description}
      icon={ScanLine}
      tone="achat"
    >
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled && !isProcessing) fileInputRef.current?.click();
            }
          }}
          className={cn(
            'rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-orange-500 bg-orange-500/5'
              : 'border-border hover:border-orange-400/60 hover:bg-muted/30',
            (disabled || isProcessing) && 'opacity-60 pointer-events-none'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            disabled={disabled || isProcessing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file);
            }}
          />
          {isProcessing ? (
            <div className="space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-orange-600" />
              <p className="text-sm text-muted-foreground">Analyse du document en cours…</p>
              {ocrProgress > 0 && ocrProgress < 100 && (
                <Progress value={ocrProgress} className="max-w-xs mx-auto h-1.5" />
              )}
            </div>
          ) : (
            <>
              <FileUp className="w-8 h-8 mx-auto text-orange-600 mb-2" />
              <p className="text-sm font-medium">Glissez un devis fournisseur ici</p>
              <p className="text-xs text-muted-foreground mt-1">PDF ou image — clic pour parcourir</p>
            </>
          )}
        </div>

        {preview && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {preview.supplier ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Fournisseur : {preview.supplier.nom}
                </Badge>
              ) : preview.header.supplierName ? (
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Détecté : {preview.header.supplierName}
                </Badge>
              ) : (
                <Badge variant="outline">Fournisseur non identifié</Badge>
              )}
              {preview.header.documentDate && (
                <Badge variant="outline">
                  Date : {formatAppDate(preview.header.documentDate)}
                </Badge>
              )}
              <Badge variant="outline">{preview.lines.length} ligne(s)</Badge>
            </div>

            <div className="max-h-40 overflow-y-auto rounded border border-border/60 bg-background text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="text-left p-2 font-medium">Désignation</th>
                    <th className="text-right p-2 font-medium w-14">Qté</th>
                    <th className="text-right p-2 font-medium w-20">P.U. HT</th>
                    <th className="text-right p-2 font-medium w-12">TVA</th>
                    <th className="text-center p-2 font-medium w-16">Cat.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, idx) => (
                    <tr key={idx} className="border-t border-border/40">
                      <td className="p-2">{line.designation}</td>
                      <td className="p-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="p-2 text-right tabular-nums">
                        {line.unitPrice.toFixed(3)}
                      </td>
                      <td className="p-2 text-right tabular-nums">{line.tvaRate}%</td>
                      <td className="p-2 text-center">
                        {line.matched ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="gap-2" onClick={handleApply}>
                <ScanLine className="w-4 h-4" />
                {copy.applyLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </DevisFormSection>
  );
}

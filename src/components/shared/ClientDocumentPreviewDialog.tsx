import type { RefObject } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import type { ClientDocumentPreviewState } from '@/hooks/useClientDocumentPreview';
import { StoragePdfViewer } from '@/components/shared/StoragePdfViewer';

interface ClientDocumentPreviewDialogProps {
  preview: ClientDocumentPreviewState;
  pdfBytesRef: RefObject<Uint8Array | null>;
  onClose: () => void;
}

export const ClientDocumentPreviewDialog = ({ preview, pdfBytesRef, onClose }: ClientDocumentPreviewDialogProps) => {
  const pdfBytes = preview.kind === 'pdf' ? pdfBytesRef.current : null;

  return (
    <Dialog
      open={preview.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        elevated
        className={`${pdfPreviewDialogContentClassName} flex flex-col`}
        onPointerDownOutside={(event) => {
          if (preview.loading) event.preventDefault();
        }}
      >
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate pr-2">{preview.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Prévisualisation du document. Utilisez le bouton Télécharger pour enregistrer une copie.
            </DialogDescription>
          </div>
          {preview.downloadUrl && !preview.loading && (
            <a href={preview.downloadUrl} download target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Download className="w-4 h-4" />
                Télécharger
              </Button>
            </a>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {preview.loading ? (
            <div className="flex h-[75vh] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Chargement du document…</span>
            </div>
          ) : preview.error ? (
            <div className="flex h-[75vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
              <p>{preview.error}</p>
            </div>
          ) : preview.kind === 'image' && preview.downloadUrl ? (
            <div className="flex h-[75vh] items-center justify-center overflow-auto rounded-lg border border-border bg-muted/30 p-4">
              <img
                src={preview.downloadUrl}
                alt={preview.title}
                className="max-h-full max-w-full object-contain shadow-sm"
              />
            </div>
          ) : preview.kind === 'pdf' && pdfBytes ? (
            <StoragePdfViewer
              key={preview.readyToken}
              data={pdfBytes}
              title={preview.title}
              downloadUrl={preview.downloadUrl}
            />
          ) : preview.kind === 'pdf' && preview.downloadUrl ? (
            <div className="h-[75vh] w-full overflow-hidden rounded-lg border border-border bg-muted/30">
              <iframe
                src={`${preview.downloadUrl}#toolbar=0&navpanes=0`}
                title={preview.title}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          ) : (
            <div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">
              Document indisponible
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { pdfPreviewDialogContentClassName } from '@/lib/pdfPreviewDialog';
import type { ClientDocumentPreviewState } from '@/hooks/useClientDocumentPreview';
import { StoragePdfViewer } from '@/components/shared/StoragePdfViewer';

interface ClientDocumentPreviewDialogProps {
  preview: ClientDocumentPreviewState;
  onClose: () => void;
}

export const ClientDocumentPreviewDialog = ({ preview, onClose }: ClientDocumentPreviewDialogProps) => (
  <Dialog open={preview.open} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className={pdfPreviewDialogContentClassName}>
      <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-4">
        <DialogTitle className="truncate pr-2">{preview.title}</DialogTitle>
        {preview.downloadUrl && !preview.loading && (
          <a href={preview.downloadUrl} download target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Download className="w-4 h-4" />
              Télécharger
            </Button>
          </a>
        )}
      </DialogHeader>
      <div className="flex-1 min-h-0">
        {preview.loading ? (
          <div className="flex h-[75vh] items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Chargement du document…</span>
          </div>
        ) : preview.pdfData ? (
          <StoragePdfViewer
            data={preview.pdfData}
            title={preview.title}
            downloadUrl={preview.downloadUrl}
          />
        ) : (
          <div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">
            Document indisponible
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

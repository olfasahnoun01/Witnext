import { useRef, useState } from 'react';
import { Eye, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  type CommercialAttachmentRecord,
  validateCommercialAttachmentFile,
  COMMERCIAL_ATTACHMENT_ACCEPT,
} from '@/lib/commercialAttachments';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { ClientDocumentPreviewDialog } from '@/components/shared/ClientDocumentPreviewDialog';
import { resolveAttachmentAccessUrl } from '@/lib/commercialAttachments';
import { toast } from 'sonner';

type Props = {
  label?: string;
  hint?: string;
  existing: CommercialAttachmentRecord[];
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
  onRemoveExisting?: (index: number) => void;
  disabled?: boolean;
};

export function CommercialAttachmentField({
  label = 'Pièces jointes',
  hint = 'PDF, images (PNG, JPEG…) ou tout fichier utile — visible par les autres utilisateurs.',
  existing,
  pendingFiles,
  onPendingChange,
  onRemoveExisting,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const { preview, pdfBytesRef, openDocumentPreview, closeDocumentPreview } = useClientDocumentPreview();

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...pendingFiles];
    for (const file of Array.from(list)) {
      const check = validateCommercialAttachmentFile(file);
      if (!check.ok) {
        toast.error(check.message);
        continue;
      }
      next.push(file);
    }
    onPendingChange(next);
  };

  const openPreview = async (att: CommercialAttachmentRecord) => {
    setPreviewBusy(true);
    try {
      const url = await resolveAttachmentAccessUrl(att);
      if (!url) {
        toast.error('Impossible d\'ouvrir le fichier');
        return;
      }
      await openDocumentPreview(url, att.name);
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept={COMMERCIAL_ATTACHMENT_ACCEPT}
            disabled={disabled}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Ajouter fichier
          </Button>
        </div>
      </div>

      {(existing.length > 0 || pendingFiles.length > 0) && (
        <ul className="space-y-1.5">
          {existing.map((att, index) => (
            <li
              key={`ex-${att.path || att.url}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{att.name}</span>
              </span>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={previewBusy || disabled}
                  title="Aperçu"
                  onClick={() => void openPreview(att)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {onRemoveExisting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={disabled}
                    onClick={() => onRemoveExisting(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {pendingFiles.map((file, index) => (
            <li
              key={`pending-${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <span className="truncate">{file.name} (à envoyer)</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={disabled}
                onClick={() => onPendingChange(pendingFiles.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ClientDocumentPreviewDialog
        preview={preview}
        pdfBytesRef={pdfBytesRef}
        onClose={closeDocumentPreview}
      />
    </div>
  );
}

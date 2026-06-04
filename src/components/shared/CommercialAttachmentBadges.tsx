import { Paperclip, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  parseAttachmentUrls,
  resolveAttachmentAccessUrl,
  type CommercialAttachmentRecord,
} from '@/lib/commercialAttachments';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { ClientDocumentPreviewDialog } from '@/components/shared/ClientDocumentPreviewDialog';
import { useState } from 'react';
import { toast } from 'sonner';

export function CommercialAttachmentBadges({
  attachments,
  metadata,
}: {
  attachments?: CommercialAttachmentRecord[] | unknown;
  metadata?: Record<string, unknown> | null;
}) {
  const list =
    attachments && Array.isArray(attachments)
      ? parseAttachmentUrls(attachments)
      : metadata?.attachment_urls
        ? parseAttachmentUrls(metadata.attachment_urls)
        : [];

  const { preview, pdfBytesRef, openDocumentPreview, closeDocumentPreview } = useClientDocumentPreview();
  const [busy, setBusy] = useState(false);

  if (list.length === 0) return null;

  const openOne = async (att: CommercialAttachmentRecord) => {
    setBusy(true);
    try {
      const url = await resolveAttachmentAccessUrl(att);
      if (!url) {
        toast.error('Fichier inaccessible');
        return;
      }
      await openDocumentPreview(url, att.name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        {list.map((att, i) => (
          <Button
            key={`${att.path || att.name}-${i}`}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={busy}
            onClick={() => void openOne(att)}
          >
            <Eye className="h-3 w-3" />
            {att.name.length > 24 ? `${att.name.slice(0, 22)}…` : att.name}
          </Button>
        ))}
        <Badge variant="secondary" className="text-[10px]">
          {list.length} fichier{list.length > 1 ? 's' : ''}
        </Badge>
      </div>
      <ClientDocumentPreviewDialog preview={preview} pdfBytesRef={pdfBytesRef} onClose={closeDocumentPreview} />
    </>
  );
}

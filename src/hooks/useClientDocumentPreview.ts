import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { loadStorageDocumentPdf } from '@/lib/clientDocumentStorage';

export interface ClientDocumentPreviewState {
  open: boolean;
  title: string;
  pdfData: ArrayBuffer | null;
  downloadUrl: string | null;
  loading: boolean;
}

const closedState: ClientDocumentPreviewState = {
  open: false,
  title: '',
  pdfData: null,
  downloadUrl: null,
  loading: false,
};

export function useClientDocumentPreview() {
  const [preview, setPreview] = useState<ClientDocumentPreviewState>(closedState);
  const blobUrlRef = useRef<string | null>(null);

  const closePreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreview(closedState);
  }, []);

  const openDocumentPreview = useCallback(async (storedUrl: string | null | undefined, title: string) => {
    if (!storedUrl?.trim()) {
      toast.error('Aucun document disponible');
      return;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setPreview({ open: true, title, pdfData: null, downloadUrl: null, loading: true });

    const loaded = await loadStorageDocumentPdf(storedUrl);
    if (!loaded) {
      toast.error('Impossible d\'ouvrir le document. Vérifiez votre connexion ou réimportez le PDF.');
      setPreview(closedState);
      return;
    }

    blobUrlRef.current = loaded.downloadUrl;
    setPreview({
      open: true,
      title,
      pdfData: loaded.data,
      downloadUrl: loaded.downloadUrl,
      loading: false,
    });
  }, []);

  return { preview, openDocumentPreview, closePreview };
}

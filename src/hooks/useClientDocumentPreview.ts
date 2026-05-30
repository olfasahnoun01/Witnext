import { useSyncExternalStore, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { loadStorageDocumentPreview, type StorageDocumentKind } from '@/lib/clientDocumentStorage';

export interface ClientDocumentPreviewState {
  open: boolean;
  title: string;
  downloadUrl: string | null;
  loading: boolean;
  kind: StorageDocumentKind | null;
  error: string | null;
  readyToken: number;
}

const closedState: ClientDocumentPreviewState = {
  open: false,
  title: '',
  downloadUrl: null,
  loading: false,
  kind: null,
  error: null,
  readyToken: 0,
};

function isPdfMagic(data: ArrayBuffer): boolean {
  if (data.byteLength < 4) return false;
  const b = new Uint8Array(data, 0, 4);
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}

type PreviewStore = {
  snapshot: ClientDocumentPreviewState;
  pdfBytes: Uint8Array | null;
  blobUrl: string | null;
  listeners: Set<() => void>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ClientDocumentPreviewState;
  publish: (next: ClientDocumentPreviewState, pdfBytes?: Uint8Array | null) => void;
};

function createPreviewStore(): PreviewStore {
  const store: PreviewStore = {
    snapshot: closedState,
    pdfBytes: null,
    blobUrl: null,
    listeners: new Set(),
    subscribe(listener) {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    getSnapshot() {
      return store.snapshot;
    },
    publish(next, pdfBytes) {
      store.snapshot = next;
      if (pdfBytes !== undefined) store.pdfBytes = pdfBytes;
      store.listeners.forEach((listener) => listener());
    },
  };
  return store;
}

export function useClientDocumentPreview() {
  const storeRef = useRef<PreviewStore>();
  if (!storeRef.current) storeRef.current = createPreviewStore();
  const store = storeRef.current;

  const loadIdRef = useRef(0);
  const pdfBytesRef = useRef<Uint8Array | null>(null);

  const preview = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  pdfBytesRef.current = store.pdfBytes;

  const closePreview = useCallback(() => {
    if (store.blobUrl) {
      URL.revokeObjectURL(store.blobUrl);
      store.blobUrl = null;
    }
    store.pdfBytes = null;
    pdfBytesRef.current = null;
    store.publish(closedState, null);
  }, [store]);

  const openDocumentPreview = useCallback(async (storedUrl: string | null | undefined, title: string) => {
    // Defer past the opening click so Radix does not treat it as an outside dismiss.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

    const loadId = ++loadIdRef.current;

    if (!storedUrl?.trim()) {
      toast.error('Aucun document disponible');
      return;
    }

    if (store.blobUrl) {
      URL.revokeObjectURL(store.blobUrl);
      store.blobUrl = null;
    }
    store.pdfBytes = null;
    pdfBytesRef.current = null;

    store.publish({
      open: true,
      title,
      downloadUrl: null,
      loading: true,
      kind: null,
      error: null,
      readyToken: 0,
    }, null);

    const loaded = await loadStorageDocumentPreview(storedUrl);
    if (loadId !== loadIdRef.current) return;

    if (!loaded) {
      toast.error('Impossible d\'ouvrir le document. Vérifiez votre connexion ou réimportez le fichier.');
      store.publish({
        open: true,
        title,
        downloadUrl: null,
        loading: false,
        kind: null,
        error: 'Téléchargement impossible. Vérifiez votre connexion ou réimportez le fichier.',
        readyToken: 0,
      }, null);
      return;
    }

    if (loaded.kind === 'pdf' && !isPdfMagic(loaded.data)) {
      toast.error('Fichier PDF invalide — réimportez le document.');
      store.publish({
        open: true,
        title,
        downloadUrl: loaded.downloadUrl,
        loading: false,
        kind: 'pdf',
        error: 'Le fichier stocké n\'est pas un PDF valide. Supprimez-le et réimportez le document.',
        readyToken: 0,
      }, null);
      return;
    }

    store.blobUrl = loaded.downloadUrl;
    const pdfBytes = loaded.kind === 'pdf' ? new Uint8Array(loaded.data) : null;
    pdfBytesRef.current = pdfBytes;

    store.publish({
      open: true,
      title,
      downloadUrl: loaded.downloadUrl,
      loading: false,
      kind: loaded.kind,
      error: null,
      readyToken: Date.now(),
    }, pdfBytes);
  }, [store]);

  return { preview, pdfBytesRef, openDocumentPreview, closePreview };
}

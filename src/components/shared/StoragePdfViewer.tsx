import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Renders a PDF from an ArrayBuffer using pdf.js (reliable in Electron; no fetch on blob/signed URLs).
 */
export const StoragePdfViewer = ({
  data,
  title,
  downloadUrl,
}: {
  data: ArrayBuffer;
  title: string;
  downloadUrl?: string | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      try {
        if (!data.byteLength) {
          throw new Error('Fichier vide');
        }

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
        if (cancelled || !containerRef.current) return;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled || !containerRef.current) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const maxWidth = containerRef.current.clientWidth - 32 || 720;
          const scale = Math.min(2, Math.max(0.75, maxWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'mx-auto mb-4 max-w-full rounded border border-border bg-white shadow-sm';
          canvas.setAttribute('aria-label', `${title} — page ${pageNum}`);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport }).promise;
          containerRef.current.appendChild(canvas);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible d\'afficher le PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void renderPdf();
    return () => {
      cancelled = true;
    };
  }, [data, title]);

  if (loading) {
    return (
      <div className="flex h-[75vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Chargement du document…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
        <p>Impossible d&apos;afficher le document.</p>
        <p className="text-xs text-destructive">{error}</p>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="text-primary underline text-sm"
          >
            Télécharger le fichier
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[75vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4"
    />
  );
};

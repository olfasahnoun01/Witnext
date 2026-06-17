import { supabase } from '@/integrations/supabase/client';
import { expandStorageDownloadPaths } from '@/lib/storagePaths';
import { getActiveCompanyId } from '@/lib/activeCompany';

const STORAGE_BUCKETS = ['client-documents', 'product-documents', 'fiches-techniques'] as const;

export type StorageBucketId = (typeof STORAGE_BUCKETS)[number];

export type StorageDocumentKind = 'pdf' | 'image';

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

function resolveDocumentKind(contentType: string, path: string): StorageDocumentKind {
  if (contentType.includes('pdf') || path.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/i.test(lower)) return 'image';
  return 'pdf';
}

/** Parse a Supabase storage URL or raw object path into bucket + file path. */
export function parseSupabaseStorageObjectUrl(url: string): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    for (const bucket of STORAGE_BUCKETS) {
      if (trimmed.startsWith(`${bucket}/`)) {
        return { bucket, path: trimmed.slice(bucket.length + 1) };
      }
    }
    if (trimmed.startsWith('fiches/')) {
      return { bucket: 'fiches-techniques', path: trimmed };
    }
    return { bucket: 'client-documents', path: trimmed };
  }

  try {
    const pathname = decodeURIComponent(new URL(trimmed).pathname);
    const patterns = [
      /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
      /^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/,
      /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/,
    ];
    for (const re of patterns) {
      const match = pathname.match(re);
      if (match) {
        const path = decodeURIComponent(match[2]).replace(/^\/+/, '');
        return { bucket: match[1], path };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function uniqueDownloadPaths(path: string): string[] {
  return expandStorageDownloadPaths(path, getActiveCompanyId());
}

const PREVIEW_CACHE_MAX = 24;
const previewBlobCache = new Map<string, Blob>();

function cacheKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

function cachePreviewBlob(bucket: string, path: string, blob: Blob): void {
  const key = cacheKey(bucket, path);
  if (previewBlobCache.has(key)) previewBlobCache.delete(key);
  previewBlobCache.set(key, blob);
  while (previewBlobCache.size > PREVIEW_CACHE_MAX) {
    const oldest = previewBlobCache.keys().next().value;
    if (oldest) previewBlobCache.delete(oldest);
    else break;
  }
}

async function downloadBlobForCandidate(bucket: string, candidate: string): Promise<Blob | null> {
  const key = cacheKey(bucket, candidate);
  const cached = previewBlobCache.get(key);
  if (cached && cached.size > 0) return cached;

  const { data, error } = await supabase.storage.from(bucket).download(candidate);
  if (!error && data && data.size > 0) {
    cachePreviewBlob(bucket, candidate, data);
    return data;
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(candidate, 3600);
  if (signError || !signed?.signedUrl) return null;

  try {
    const response = await fetch(signed.signedUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size > 0) {
      cachePreviewBlob(bucket, candidate, blob);
      return blob;
    }
  } catch {
    /* try next candidate */
  }
  return null;
}

async function downloadBlobFromBucket(bucket: string, path: string): Promise<Blob | null> {
  for (const candidate of uniqueDownloadPaths(path)) {
    const blob = await downloadBlobForCandidate(bucket, candidate);
    if (blob) return blob;
  }
  return null;
}

export type ResolvedDocumentPreview = {
  data: ArrayBuffer;
  downloadUrl: string;
};

export type ResolvedStoragePreview = ResolvedDocumentPreview & {
  contentType: string;
  kind: StorageDocumentKind;
};

async function downloadStorageDocument(
  storedUrl: string | null | undefined
): Promise<{ blob: Blob; data: ArrayBuffer; ref: { bucket: string; path: string } } | null> {
  if (!storedUrl?.trim()) return null;

  const raw = storedUrl.trim();

  const ref = parseSupabaseStorageObjectUrl(raw);
  if (!ref) return null;

  const path = ref.path.replace(/^\/+/, '');

  const tryDownload = async () => {
    let blob = await downloadBlobFromBucket(ref.bucket, path);
    if (!blob) {
      for (const altBucket of STORAGE_BUCKETS) {
        if (altBucket === ref.bucket) continue;
        blob = await downloadBlobFromBucket(altBucket, path);
        if (blob) break;
      }
    }
    return blob;
  };

  let blob = await tryDownload();

  if (!blob) {
    try {
      await supabase.auth.refreshSession();
      blob = await tryDownload();
    } catch {
      /* session refresh failed */
    }
  }

  if (!blob) {
    console.warn('[downloadStorageDocument] download failed', { bucket: ref.bucket, path });
    return null;
  }

  const data = await blob.arrayBuffer();
  if (!data.byteLength) return null;

  return { blob, data, ref: { bucket: ref.bucket, path } };
}

/**
 * Loads Patente/RNE/fiche via authenticated Supabase download (PDF or image).
 * Safe for Electron — no cross-origin fetch on public URLs.
 */
export async function loadStorageDocumentPreview(
  storedUrl: string | null | undefined
): Promise<ResolvedStoragePreview | null> {
  const downloaded = await downloadStorageDocument(storedUrl);
  if (!downloaded) return null;

  const { blob, data, ref } = downloaded;
  const contentType = blob.type || mimeFromPath(ref.path);
  const kind = resolveDocumentKind(contentType, ref.path);
  const displayBlob =
    kind === 'pdf' && !contentType.includes('pdf')
      ? new Blob([data], { type: 'application/pdf' })
      : blob.type
        ? blob
        : new Blob([data], { type: contentType });
  const downloadUrl = URL.createObjectURL(displayBlob);

  return { data, downloadUrl, contentType, kind };
}

/**
 * Loads a stored PDF via authenticated Supabase download (no cross-origin fetch).
 */
export async function loadStorageDocumentPdf(
  storedUrl: string | null | undefined
): Promise<ResolvedDocumentPreview | null> {
  const loaded = await loadStorageDocumentPreview(storedUrl);
  if (!loaded) return null;
  return { data: loaded.data, downloadUrl: loaded.downloadUrl };
}

/** @deprecated Prefer loadStorageDocumentPdf */
export type ResolvedDocumentUrl = { url: string; isBlob: boolean };

export async function resolveStorageDocumentUrl(
  storedUrl: string | null | undefined
): Promise<ResolvedDocumentUrl | null> {
  const loaded = await loadStorageDocumentPreview(storedUrl);
  if (!loaded) return null;
  return { url: loaded.downloadUrl, isBlob: true };
}

/** Parse fiche_technique_url stored as a single URL or JSON array of URLs. */
export function parseFicheTechniqueUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to single URL */
    }
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    /* not JSON */
  }

  return [trimmed];
}

function triggerBrowserDownload(data: Blob | ArrayBuffer, fileName: string, mimeType?: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function addImageDataToJsPdf(
  pdf: import('jspdf').jsPDF,
  data: ArrayBuffer,
  contentType: string,
  hasPages: boolean,
): Promise<boolean> {
  if (hasPages) pdf.addPage();

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const blob = new Blob([data], { type: contentType });
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Impossible de lire l\'image'));
    reader.readAsDataURL(blob);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Impossible de charger l\'image'));
    image.src = base64;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  const pngBase64 = canvas.toDataURL('image/png');

  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;

  pdf.addImage(pngBase64, 'PNG', x, y, w, h, undefined, 'NONE');
  return true;
}

async function addPdfDataToJsPdf(
  pdf: import('jspdf').jsPDF,
  data: ArrayBuffer,
  hasPages: boolean,
): Promise<boolean> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const pdfDoc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let added = hasPages;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    if (added) pdf.addPage();

    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / baseViewport.width, availH / baseViewport.height, 2);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pngBase64 = canvas.toDataURL('image/png');
    const ratio = Math.min(availW / viewport.width, availH / viewport.height);
    const w = viewport.width * ratio;
    const h = viewport.height * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;

    pdf.addImage(pngBase64, 'PNG', x, y, w, h, undefined, 'NONE');
    added = true;
  }

  return added;
}

/**
 * Downloads fiche technique file(s) via authenticated storage access.
 * Multiple files are merged into a single PDF; a lone PDF is downloaded as-is.
 */
export async function downloadFicheTechniquesAsPdf(
  urls: string[],
  fileName: string,
): Promise<boolean> {
  const cleanUrls = urls.map((url) => url.trim()).filter(Boolean);
  if (cleanUrls.length === 0) return false;

  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  if (cleanUrls.length === 1) {
    const loaded = await loadStorageDocumentPreview(cleanUrls[0]);
    if (!loaded) return false;

    try {
      if (loaded.kind === 'pdf') {
        triggerBrowserDownload(loaded.data, safeFileName, 'application/pdf');
        return true;
      }

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
      await addImageDataToJsPdf(pdf, loaded.data, loaded.contentType, false);
      pdf.save(safeFileName);
      return true;
    } finally {
      URL.revokeObjectURL(loaded.downloadUrl);
    }
  }

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  let hasPages = false;

  for (const url of cleanUrls) {
    const loaded = await loadStorageDocumentPreview(url);
    if (!loaded) continue;

    try {
      if (loaded.kind === 'pdf') {
        hasPages = await addPdfDataToJsPdf(pdf, loaded.data, hasPages);
      } else {
        hasPages = await addImageDataToJsPdf(pdf, loaded.data, loaded.contentType, hasPages) || hasPages;
      }
    } finally {
      URL.revokeObjectURL(loaded.downloadUrl);
    }
  }

  if (!hasPages) return false;

  pdf.save(safeFileName);
  return true;
}

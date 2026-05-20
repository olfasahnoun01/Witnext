import { supabase } from '@/integrations/supabase/client';

const STORAGE_BUCKETS = ['client-documents', 'product-documents'] as const;

export type StorageBucketId = (typeof STORAGE_BUCKETS)[number];

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
  const normalized = path.replace(/^\/+/, '');
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    /* keep normalized */
  }
  const base = normalized.split('/').pop() || normalized;
  return [...new Set([normalized, decoded, base].filter(Boolean))];
}

async function downloadBlobFromBucket(bucket: string, path: string): Promise<Blob | null> {
  for (const candidate of uniqueDownloadPaths(path)) {
    const { data, error } = await supabase.storage.from(bucket).download(candidate);
    if (!error && data && data.size > 0) {
      return data;
    }
  }
  return null;
}

export type ResolvedDocumentPreview = {
  data: ArrayBuffer;
  /** Blob URL for download / open in browser; revoke when done */
  downloadUrl: string;
};

/**
 * Loads a stored PDF via authenticated Supabase download (no cross-origin fetch).
 * Safe for Electron preview — pass `data` directly to pdf.js.
 */
export async function loadStorageDocumentPdf(
  storedUrl: string | null | undefined
): Promise<ResolvedDocumentPreview | null> {
  if (!storedUrl?.trim()) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    console.warn('[loadStorageDocumentPdf] no authenticated session');
    return null;
  }

  const raw = storedUrl.trim();
  const ref = parseSupabaseStorageObjectUrl(raw);

  if (!ref) {
    return null;
  }

  const path = ref.path.replace(/^\/+/, '');
  let blob = await downloadBlobFromBucket(ref.bucket, path);

  if (!blob) {
    for (const altBucket of STORAGE_BUCKETS) {
      if (altBucket === ref.bucket) continue;
      blob = await downloadBlobFromBucket(altBucket, path);
      if (blob) break;
    }
  }

  if (!blob) {
    console.warn('[loadStorageDocumentPdf] download failed', { bucket: ref.bucket, path });
    return null;
  }

  const data = await blob.arrayBuffer();
  if (!data.byteLength) return null;

  const pdfBlob =
    blob.type === 'application/pdf' ? blob : new Blob([data], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(pdfBlob);
  return { data, downloadUrl };
}

/** @deprecated Prefer loadStorageDocumentPdf — avoids fetch() on signed/blob URLs in Electron */
export type ResolvedDocumentUrl = { url: string; isBlob: boolean };

export async function resolveStorageDocumentUrl(
  storedUrl: string | null | undefined
): Promise<ResolvedDocumentUrl | null> {
  const loaded = await loadStorageDocumentPdf(storedUrl);
  if (!loaded) return null;
  return { url: loaded.downloadUrl, isBlob: true };
}

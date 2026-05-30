import { supabase } from '@/integrations/supabase/client';

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

  for (const candidate of uniqueDownloadPaths(path)) {
    const { data: signed, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(candidate, 3600);
    if (signError || !signed?.signedUrl) continue;
    try {
      const response = await fetch(signed.signedUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      if (blob.size > 0) return blob;
    } catch {
      /* try next candidate */
    }
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

  try {
    await supabase.auth.refreshSession();
  } catch {
    /* continue with current client auth */
  }

  const ref = parseSupabaseStorageObjectUrl(raw);
  if (!ref) return null;

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

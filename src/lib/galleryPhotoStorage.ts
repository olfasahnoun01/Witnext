import { supabase } from '@/integrations/supabase/client';
import { expandStorageDownloadPaths } from '@/lib/storagePaths';
import { getActiveCompanyId } from '@/lib/activeCompany';

export const GALLERY_PHOTOS_BUCKET = 'gallery-photos';

/** Smaller transformed image for grid/thumbnails — less Storage egress than full size. */
export type GalleryPhotoVariant = 'thumb' | 'full';

const SIGNED_URL_TTL_SEC = 3600;
const SIGNED_URL_CACHE_MARGIN_MS = 5 * 60 * 1000;
const SIGNED_URL_CACHE_MAX = 120;

type CachedSigned = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, CachedSigned>();
const inflightResolves = new Map<string, Promise<string>>();

const THUMB_TRANSFORM = {
  width: 400,
  height: 400,
  resize: 'cover' as const,
};

/** Parse a stored gallery photo value (full URL or bucket-relative path). */
export function parseGalleryPhotoStorageRef(
  url: string
): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith(`${GALLERY_PHOTOS_BUCKET}/`)) {
      return {
        bucket: GALLERY_PHOTOS_BUCKET,
        path: trimmed.slice(GALLERY_PHOTOS_BUCKET.length + 1),
      };
    }
    return { bucket: GALLERY_PHOTOS_BUCKET, path: trimmed.replace(/^\/+/, '') };
  }

  try {
    const pathname = decodeURIComponent(new URL(trimmed).pathname);
    const match = pathname.match(
      /^\/storage\/v1\/object\/(?:public|authenticated|sign|render\/image\/sign)\/gallery-photos\/(.+)$/
    );
    if (match) {
      return {
        bucket: GALLERY_PHOTOS_BUCKET,
        path: decodeURIComponent(match[1]).replace(/^\/+/, ''),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function isExternalGalleryPhotoUrl(url: string): boolean {
  return parseGalleryPhotoStorageRef(url) === null;
}

function signedCacheKey(storedUrl: string, variant: GalleryPhotoVariant): string {
  const ref = parseGalleryPhotoStorageRef(storedUrl);
  if (!ref) return `ext:${variant}:${storedUrl}`;
  return `${GALLERY_PHOTOS_BUCKET}:${variant}:${ref.path}`;
}

function readSignedCache(key: string): string | null {
  const cached = signedUrlCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now() + SIGNED_URL_CACHE_MARGIN_MS) {
    signedUrlCache.delete(key);
    return null;
  }
  return cached.url;
}

function writeSignedCache(key: string, url: string): void {
  if (signedUrlCache.has(key)) signedUrlCache.delete(key);
  signedUrlCache.set(key, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
  });
  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX) {
    const oldest = signedUrlCache.keys().next().value;
    if (oldest) signedUrlCache.delete(oldest);
    else break;
  }
}

/**
 * Authenticated display URL for gallery-photos.
 * - Session cache + in-flight dedupe (one sign request per photo per variant).
 * - Thumb variant uses Supabase image transform (smaller egress).
 * - No storage.download() — signing is metadata-only; egress happens once per browser fetch.
 */
export async function resolveGalleryPhotoDisplayUrl(
  storedUrl: string,
  variant: GalleryPhotoVariant = 'full'
): Promise<string> {
  const ref = parseGalleryPhotoStorageRef(storedUrl);
  if (!ref) return storedUrl;

  const cacheKey = signedCacheKey(storedUrl, variant);
  const hit = readSignedCache(cacheKey);
  if (hit) return hit;

  const pending = inflightResolves.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const candidates = expandStorageDownloadPaths(ref.path, getActiveCompanyId());
    const signOptions =
      variant === 'thumb' ? { transform: THUMB_TRANSFORM } : undefined;

    for (const candidate of candidates) {
      const { data, error } = await supabase.storage
        .from(GALLERY_PHOTOS_BUCKET)
        .createSignedUrl(candidate, SIGNED_URL_TTL_SEC, signOptions);
      if (!error && data?.signedUrl) {
        writeSignedCache(cacheKey, data.signedUrl);
        return data.signedUrl;
      }
    }

    return storedUrl;
  })();

  inflightResolves.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightResolves.delete(cacheKey);
  }
}

/** Test helper — clears in-memory signed URL cache. */
export function clearGalleryPhotoSignedUrlCacheForTests(): void {
  signedUrlCache.clear();
  inflightResolves.clear();
}

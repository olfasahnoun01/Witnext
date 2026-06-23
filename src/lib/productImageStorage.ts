import { supabase } from '@/integrations/supabase/client';
import { buildCompanyStoragePath, expandStorageDownloadPaths } from '@/lib/storagePaths';
import { getActiveCompanyId } from '@/lib/activeCompany';

/** Reuse fiches-techniques bucket with a dedicated prefix (RLS already company-scoped). */
export const PRODUCT_IMAGE_BUCKET = 'fiches-techniques';
const PRODUCT_IMAGE_PREFIX = 'product-images';

export type ProductImageVariant = 'thumb' | 'full';

const SIGNED_URL_TTL_SEC = 3600;
const SIGNED_URL_CACHE_MARGIN_MS = 5 * 60 * 1000;
const SIGNED_URL_CACHE_MAX = 200;

const THUMB_TRANSFORM = {
  width: 160,
  height: 160,
  resize: 'cover' as const,
};

type CachedSigned = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, CachedSigned>();
const inflightResolves = new Map<string, Promise<string>>();
const imageRefCache = new Map<string, string | null>();

export function isInlineProductImage(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('data:');
}

export function parseProductImageStoragePath(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed || isInlineProductImage(trimmed)) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, '');
  }

  try {
    const pathname = decodeURIComponent(new URL(trimmed).pathname);
    const match = pathname.match(
      /^\/storage\/v1\/object\/(?:public|authenticated|sign|render\/image\/sign)\/fiches-techniques\/(.+)$/
    );
    if (match) {
      return decodeURIComponent(match[1]).replace(/^\/+/, '');
    }
  } catch {
    return null;
  }
  return null;
}

function signedCacheKey(stored: string, variant: ProductImageVariant): string {
  return `${PRODUCT_IMAGE_BUCKET}:${variant}:${stored}`;
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
  signedUrlCache.set(key, { url, expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000 });
  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX) {
    const oldest = signedUrlCache.keys().next().value;
    if (oldest) signedUrlCache.delete(oldest);
    else break;
  }
}

/**
 * Resolve a stored product/group image to a browser display URL.
 * Inline base64 is returned as-is (legacy). Storage paths use signed URLs + thumb transform.
 */
export async function resolveProductImageDisplayUrl(
  stored: string | null | undefined,
  variant: ProductImageVariant = 'thumb'
): Promise<string | null> {
  if (!stored?.trim()) return null;
  if (isInlineProductImage(stored)) return stored;

  const cacheKey = signedCacheKey(stored, variant);
  const hit = readSignedCache(cacheKey);
  if (hit) return hit;

  const pending = inflightResolves.get(cacheKey);
  if (pending) return pending;

  const path = parseProductImageStoragePath(stored) ?? stored.replace(/^\/+/, '');
  const promise = (async () => {
    const candidates = expandStorageDownloadPaths(path, getActiveCompanyId());
    const signOptions = variant === 'thumb' ? { transform: THUMB_TRANSFORM } : undefined;

    for (const candidate of candidates) {
      const { data, error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .createSignedUrl(candidate, SIGNED_URL_TTL_SEC, signOptions);
      if (!error && data?.signedUrl) {
        writeSignedCache(cacheKey, data.signedUrl);
        return data.signedUrl;
      }
    }

    if (/^https?:\/\//i.test(stored)) return stored;
    return null;
  })();

  inflightResolves.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightResolves.delete(cacheKey);
  }
}

/** Upload compressed image bytes; returns bucket-relative path to store in DB. */
export async function uploadProductImageFile(
  file: Blob,
  fileName: string
): Promise<string> {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  const path = buildCompanyStoragePath(`${PRODUCT_IMAGE_PREFIX}/${Date.now()}-${safeName}`);
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/webp',
  });
  if (error) throw error;
  return path;
}

/** If value is inline base64, upload to Storage and return path; otherwise return as-is. */
export async function persistProductImageIfInline(
  value: string | null | undefined,
  fileName: string
): Promise<string | null> {
  if (!value?.trim()) return null;
  if (!isInlineProductImage(value)) return value;

  const res = await fetch(value);
  const blob = await res.blob();
  return uploadProductImageFile(blob, fileName);
}

export async function fetchProductGroupImageRef(groupId: number): Promise<string | null> {
  const key = `group:${groupId}`;
  if (imageRefCache.has(key)) return imageRefCache.get(key) ?? null;

  const { data, error } = await supabase
    .from('product_groups')
    .select('image')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    console.error('fetchProductGroupImageRef', error);
    return null;
  }

  const ref = (data as { image?: string | null } | null)?.image ?? null;
  imageRefCache.set(key, ref);
  return ref;
}

export async function fetchProductImageRef(productId: number): Promise<string | null> {
  const key = `product:${productId}`;
  if (imageRefCache.has(key)) return imageRefCache.get(key) ?? null;

  const { data, error } = await supabase
    .from('products')
    .select('image')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    console.error('fetchProductImageRef', error);
    return null;
  }

  const ref = (data as { image?: string | null } | null)?.image ?? null;
  imageRefCache.set(key, ref);
  return ref;
}

export function clearProductImageCachesForTests(): void {
  signedUrlCache.clear();
  inflightResolves.clear();
  imageRefCache.clear();
}

export type BackupImageRef = {
  id: number;
  image: string;
  product_group_id?: number | null;
  name?: string;
};

/** Storage paths only — skips inline base64 to keep backup/export egress low. */
export async function fetchProductImageRefsForBackup(
  companyId: string
): Promise<{ products: BackupImageRef[]; groups: BackupImageRef[] }> {
  const [productsRes, groupsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, image, product_group_id, name')
      .eq('company_id', companyId)
      .not('image', 'is', null)
      .not('image', 'like', 'data:%'),
    supabase
      .from('product_groups')
      .select('id, image, name')
      .eq('company_id', companyId)
      .not('image', 'is', null)
      .not('image', 'like', 'data:%'),
  ]);

  if (productsRes.error) console.error('fetchProductImageRefsForBackup products', productsRes.error);
  if (groupsRes.error) console.error('fetchProductImageRefsForBackup groups', groupsRes.error);

  return {
    products: (productsRes.data ?? []) as BackupImageRef[],
    groups: (groupsRes.data ?? []) as BackupImageRef[],
  };
}

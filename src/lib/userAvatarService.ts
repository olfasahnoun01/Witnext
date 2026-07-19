import { supabase } from '@/integrations/supabase/client';
import { convertFileToWebp } from '@/lib/imageCompression';

export const AVATARS_BUCKET = 'avatars';

/** Max original file size accepted before compression. */
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
/** Soft cap after compression — keep DB/Storage light. */
const MAX_COMPRESSED_BYTES = 120 * 1024;
const AVATAR_MAX_PX = 256;
const AVATAR_QUALITY = 0.78;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function avatarStoragePath(userId: string): string {
  return `${userId}/avatar.webp`;
}

/** Strip cache-busting query params for storage operations. */
export function avatarPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = `/object/public/${AVATARS_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export function withAvatarCacheBust(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = url.split('?')[0];
  return `${base}?v=${Date.now()}`;
}

export async function fetchProfileAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
}

/**
 * Compress to a small square-ish WebP, upsert one object per user, store only the URL on profiles.
 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Utilisez JPEG, PNG ou WebP.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('L’image ne doit pas dépasser 2 Mo.');
  }

  const { blob } = await convertFileToWebp(file, {
    maxWidth: AVATAR_MAX_PX,
    maxHeight: AVATAR_MAX_PX,
    quality: AVATAR_QUALITY,
    format: 'image/webp',
  });

  if (blob.size > MAX_COMPRESSED_BYTES) {
    throw new Error('Image trop lourde après compression. Choisissez une photo plus simple.');
  }

  const path = avatarStoragePath(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const publicUrl = withAvatarCacheBust(data.publicUrl)!;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl.split('?')[0],
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId);
  if (profileError) throw profileError;

  return publicUrl;
}

export async function removeUserAvatar(userId: string): Promise<void> {
  const path = avatarStoragePath(userId);
  await supabase.storage.from(AVATARS_BUCKET).remove([path]);

  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId);
  if (error) throw error;
}

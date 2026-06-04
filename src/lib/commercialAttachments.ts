import { supabase } from '@/integrations/supabase/client';
import { MAX_UPLOAD_BYTES, resolveUploadMimeType } from '@/lib/uploadValidation';

export const COMMERCIAL_ATTACHMENTS_BUCKET = 'commercial-attachments';

export const COMMERCIAL_ATTACHMENT_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.doc,.docx,.xls,.xlsx,.txt,application/pdf,image/*';

export type CommercialAttachmentRecord = {
  url: string;
  name: string;
  mime: string;
  path?: string;
};

export function parseAttachmentUrls(raw: unknown): CommercialAttachmentRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      url: String(item.url || ''),
      name: String(item.name || 'Fichier'),
      mime: String(item.mime || 'application/octet-stream'),
      path: item.path ? String(item.path) : undefined,
    }))
    .filter((item) => item.url.length > 0);
}

export function validateCommercialAttachmentFile(file: File): { ok: true } | { ok: false; message: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: `${file.name} : max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo` };
  }
  return { ok: true };
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'fichier';
}

export async function uploadCommercialAttachments(
  files: File[],
  folder: string
): Promise<CommercialAttachmentRecord[]> {
  const uploaded: CommercialAttachmentRecord[] = [];
  const stamp = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const check = validateCommercialAttachmentFile(file);
    if (!check.ok) throw new Error(check.message);

    const path = `${folder}/${stamp}_${i}_${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from(COMMERCIAL_ATTACHMENTS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: resolveUploadMimeType(file),
    });
    if (error) throw error;

    uploaded.push({
      url: '',
      name: file.name,
      mime: resolveUploadMimeType(file),
      path,
    });
  }

  return uploaded;
}

export async function getCommercialAttachmentSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(COMMERCIAL_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Resolve signed URL for preview/download (private bucket). */
export async function resolveAttachmentAccessUrl(
  att: CommercialAttachmentRecord
): Promise<string | null> {
  if (att.path) {
    const signed = await getCommercialAttachmentSignedUrl(att.path);
    if (signed) return signed;
  }
  return att.url || null;
}

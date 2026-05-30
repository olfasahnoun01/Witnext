export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Patente, RNE (rc), and similar legal documents. */
export const LEGAL_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const LEGAL_DOCUMENT_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export function mimeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function resolveUploadMimeType(file: File): string {
  return file.type || mimeFromFileName(file.name) || 'application/octet-stream';
}

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateUploadFile(
  file: File,
  allowedMimeTypes: readonly string[],
  maxBytes = MAX_UPLOAD_BYTES
): UploadValidationResult {
  if (file.size > maxBytes) {
    return { ok: false, message: `${file.name} : taille max ${Math.round(maxBytes / (1024 * 1024))} Mo` };
  }
  const mime = resolveUploadMimeType(file);
  if (!allowedMimeTypes.includes(mime)) {
    return { ok: false, message: `${file.name} : format non autorisé` };
  }
  return { ok: true };
}

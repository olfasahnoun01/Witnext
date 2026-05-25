export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateUploadFile(
  file: File,
  allowedMimeTypes: string[],
  maxBytes = MAX_UPLOAD_BYTES
): UploadValidationResult {
  if (file.size > maxBytes) {
    return { ok: false, message: `${file.name} : taille max ${Math.round(maxBytes / (1024 * 1024))} Mo` };
  }
  if (!allowedMimeTypes.includes(file.type)) {
    return { ok: false, message: `${file.name} : format non autorisé` };
  }
  return { ok: true };
}

/** Sanitize a string for use as a file or folder name (Windows-safe). */
export function sanitizeFileName(name: string, fallback = 'export'): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

export function buildCompanyPlanningJsonFileName(companyName: string): string {
  return `${sanitizeFileName(companyName, 'planning')}_planning.json`;
}

export interface SaveBlobOptions {
  blob: Blob;
  suggestedName: string;
  description?: string;
  mimeType: string;
  extension: string;
}

function ensureExtension(name: string, extension: string): string {
  const ext = `.${extension}`;
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function canUseSaveFilePicker(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/** Opens the native Save As dialog when supported; otherwise downloads the file. */
export async function saveBlobWithPicker(
  options: SaveBlobOptions
): Promise<'saved' | 'cancelled'> {
  const filename = ensureExtension(options.suggestedName, options.extension);

  if (canUseSaveFilePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: options.description ?? options.extension.toUpperCase(),
            accept: { [options.mimeType]: [`.${options.extension}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(options.blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      console.warn('showSaveFilePicker failed, falling back to download', err);
    }
  }

  downloadBlob(options.blob, filename);
  return 'saved';
}

export async function saveJsPdfWithPicker(
  doc: { output(type: 'blob'): Blob },
  suggestedName: string
): Promise<'saved' | 'cancelled'> {
  return saveBlobWithPicker({
    blob: doc.output('blob'),
    suggestedName,
    description: 'PDF File',
    mimeType: 'application/pdf',
    extension: 'pdf',
  });
}

/**
 * Image compression utility
 * Converts images to JPEG at full quality before storage
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.95,
  format: 'image/webp',
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<string> - Base64 encoded image
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const aspectRatio = width / height;
          if (width > height) {
            width = Math.min(width, opts.maxWidth!);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, opts.maxHeight!);
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL(opts.format!, opts.quality);
        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress an existing base64 image string
 * @param base64 - The base64 encoded image
 * @param options - Compression options
 * @returns Promise<string> - JPEG base64 image
 */
export async function compressBase64Image(
  base64: string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const aspectRatio = width / height;
        if (width > height) {
          width = Math.min(width, opts.maxWidth!);
          height = width / aspectRatio;
        } else {
          height = Math.min(height, opts.maxHeight!);
          width = height * aspectRatio;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL(opts.format!, opts.quality);
      resolve(compressedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = base64;
  });
}

/**
 * Convert any file (image or PDF) to a compressed Blob for storage upload.
 * Default format is WebP at 95% quality.
 */
export async function convertFileToWebp(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; ext: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (file.type === 'application/pdf') {
    return convertPdfToWebp(file, opts as any);
  }

  return convertImageBlobToWebp(file, opts as any);
}

/** Backward compatibility aliases */
export const convertImageFileToWebp = convertFileToWebp;
export const convertImageFileToJpeg = convertFileToWebp;

/** Render first page of a PDF to a WebP blob */
async function convertPdfToWebp(
  file: File,
  opts: CompressionOptions & { maxWidth: number; maxHeight: number }
): Promise<{ blob: Blob; ext: string }> {
  const blobs = await convertPdfAllPagesToWebp(file, opts);
  return blobs[0];
}

/** Render first page of a PDF to a JPEG blob (Alias) */
export const convertPdfToJpeg = convertPdfToWebp;

/**
 * Convert ALL pages of a PDF to WebP blobs.
 */
export async function convertPdfAllPagesToWebp(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; ext: string }[]> {
  const opts = { maxWidth: 2048, maxHeight: 2048, quality: 0.95, format: 'image/webp', ...options };
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const results: { blob: Blob; ext: string }[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const scale = 4;
    const viewport = page.getViewport({ scale });

    let width = viewport.width;
    let height = viewport.height;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const ratio = width / height;
      if (width > height) {
        width = opts.maxWidth;
        height = width / ratio;
      } else {
        height = opts.maxHeight;
        width = height * ratio;
      }
    }

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = viewport.width;
    tmpCanvas.height = viewport.height;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    await page.render({ canvasContext: tmpCtx, viewport }).promise;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmpCanvas, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) { reject(new Error('WebP conversion failed')); return; }
          resolve(b);
        },
        opts.format!,
        opts.quality
      );
    });
    results.push({ blob, ext: opts.format === 'image/webp' ? 'webp' : 'jpeg' });
  }

  return results;
}

/** Alias for backward compatibility */
export const convertPdfAllPagesToJpeg = convertPdfAllPagesToWebp;

/** Convert an image file/blob to WebP */
function convertImageBlobToWebp(
  file: Blob,
  opts: CompressionOptions & { maxWidth: number; maxHeight: number; quality: number; format: string }
): Promise<{ blob: Blob; ext: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > opts.maxWidth || height > opts.maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = Math.min(width, opts.maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, opts.maxHeight);
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('WebP conversion failed')); return; }
            resolve({ blob, ext: opts.format === 'image/webp' ? 'webp' : 'jpeg' });
          },
          opts.format!,
          opts.quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get the size of a base64 string in bytes
 */
export function getBase64Size(base64: string): number {
  const base64Data = base64.split(',')[1] || base64;
  return Math.ceil((base64Data.length * 3) / 4);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

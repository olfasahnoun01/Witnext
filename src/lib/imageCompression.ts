/**
 * Image compression utility
 * Converts images to JPEG at full quality before storage
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 1.0,
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<string> - Base64 encoded JPEG image
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 1.0);
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

      const compressedBase64 = canvas.toDataURL('image/jpeg', 1.0);
      resolve(compressedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = base64;
  });
}

/**
 * Convert any file (image or PDF) to a JPEG Blob for storage upload.
 * PDFs are rendered (first page) then converted to JPEG.
 */
export async function convertImageFileToJpeg(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; ext: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options, maxWidth: 5000, maxHeight: 5000 };

  if (file.type === 'application/pdf') {
    return convertPdfToJpeg(file, opts);
  }

  return convertImageBlobToJpeg(file, opts);
}

/** Keep old name as alias for backward compatibility */
export const convertImageFileToWebp = convertImageFileToJpeg;

/** Render first page of a PDF to a JPEG blob */
async function convertPdfToJpeg(
  file: File,
  opts: CompressionOptions & { maxWidth: number; maxHeight: number }
): Promise<{ blob: Blob; ext: string }> {
  const blobs = await convertPdfAllPagesToJpeg(file, opts);
  return blobs[0];
}

/**
 * Convert ALL pages of a PDF to JPEG blobs.
 */
export async function convertPdfAllPagesToJpeg(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; ext: string }[]> {
  const opts = { maxWidth: 5000, maxHeight: 5000, quality: 1.0, ...options };
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
          if (!b) { reject(new Error('JPEG conversion failed')); return; }
          resolve(b);
        },
        'image/jpeg',
        1.0
      );
    });
    results.push({ blob, ext: 'jpeg' });
  }

  return results;
}

/** Keep old name as alias for backward compatibility */
export const convertPdfAllPagesToWebp = convertPdfAllPagesToJpeg;

/** Convert an image file/blob to JPEG */
function convertImageBlobToJpeg(
  file: Blob,
  opts: CompressionOptions & { maxWidth: number; maxHeight: number }
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
            if (!blob) { reject(new Error('JPEG conversion failed')); return; }
            resolve({ blob, ext: 'jpeg' });
          },
          'image/jpeg',
          1.0
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

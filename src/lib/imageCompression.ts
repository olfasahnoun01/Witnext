/**
 * Image compression utility
 * Compresses images before storage to reduce database load and improve performance
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.7,
};

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<string> - Base64 encoded compressed image
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

        // Calculate new dimensions while maintaining aspect ratio
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

        // Draw image with smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        const compressedBase64 = canvas.toDataURL('image/webp', opts.quality);
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
 * @returns Promise<string> - Compressed base64 image
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

      // Calculate new dimensions while maintaining aspect ratio
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

      const compressedBase64 = canvas.toDataURL('image/webp', opts.quality);
      resolve(compressedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = base64;
  });
}

/**
 * Convert an image File to a WebP Blob for storage upload
 * PDFs are returned as-is.
 */
export async function convertImageFileToWebp(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; ext: string }> {
  // If it's a PDF, return as-is
  if (file.type === 'application/pdf') {
    return { blob: file, ext: 'pdf' };
  }

  const opts = { ...DEFAULT_OPTIONS, ...options, maxWidth: 1920, maxHeight: 1920 };

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
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('WebP conversion failed')); return; }
            resolve({ blob, ext: 'webp' });
          },
          'image/webp',
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

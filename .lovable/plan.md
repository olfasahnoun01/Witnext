

## Plan: Fix PDF Download Quality for Fiches Techniques

### Problem
`jsPDF.addImage` with JPEG format applies internal compression, degrading image quality regardless of the original upload quality.

### Solution
In `src/components/inventory/VariantView.tsx`, modify `downloadFichesAsPdf`:

1. **Draw each image onto a canvas at native resolution** and export as PNG (lossless)
2. **Use `'PNG'` format** in `pdf.addImage()` instead of `'JPEG'` to avoid recompression
3. **Set jsPDF compression to `'NONE'`** via the `compression` parameter in `addImage`

### Changes

**File: `src/components/inventory/VariantView.tsx`** (lines ~362-378)

Replace the current image loading + addImage block with:
```typescript
// Draw image on canvas at native resolution, export as PNG
const img = await new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = base64;
});

const canvas = document.createElement('canvas');
canvas.width = img.naturalWidth;
canvas.height = img.naturalHeight;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(img, 0, 0);
const pngBase64 = canvas.toDataURL('image/png');

const availW = pageW - margin * 2;
const availH = pageH - margin * 2;
const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
const w = img.naturalWidth * ratio;
const h = img.naturalHeight * ratio;
const x = (pageW - w) / 2;
const y = (pageH - h) / 2;

pdf.addImage(pngBase64, 'PNG', x, y, w, h, undefined, 'NONE');
```

This ensures zero quality loss: the original image pixels are preserved through PNG (lossless) encoding and no jsPDF compression is applied.


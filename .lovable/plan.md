

## Plan: Replace WebP with JPEG at 100% Quality

### Files to Modify (6 files)

#### 1. `src/lib/imageCompression.ts`
- All `toDataURL('image/webp', ...)` → `toDataURL('image/jpeg', 1.0)`
- All `toBlob(..., 'image/webp', ...)` → `toBlob(..., 'image/jpeg', 1.0)`
- Rename: `convertImageFileToWebp` → `convertImageFileToJpeg`, `convertPdfAllPagesToWebp` → `convertPdfAllPagesToJpeg`, helper functions accordingly
- All `ext: 'webp'` → `ext: 'jpeg'`
- Default quality: `1.0`

#### 2. `src/components/inventory/ProductModal.tsx`
- Fallback: `toDataURL('image/webp', 0.7)` → `toDataURL('image/jpeg', 1.0)`

#### 3. `src/components/inventory/ProductGroupModal.tsx`
- Import rename: `convertImageFileToWebp` → `convertImageFileToJpeg`
- Upload contentType: `'image/webp'` → `'image/jpeg'`
- Fallback canvas: `toDataURL('image/webp', 0.7)` → `toDataURL('image/jpeg', 1.0)`

#### 4. `src/components/inventory/VariantView.tsx`
- Import rename: `convertImageFileToWebp` → `convertImageFileToJpeg`, `convertPdfAllPagesToWebp` → `convertPdfAllPagesToJpeg`
- Upload contentType: `'image/webp'` → `'image/jpeg'`
- Fallback canvas: `toDataURL('image/webp', 0.7)` → `toDataURL('image/jpeg', 1.0)`
- PDF download: `pdf.addImage(base64, 'WEBP', ...)` → `pdf.addImage(base64, 'JPEG', ...)`

#### 5. `src/components/devis/DevisForm.tsx`
- Import rename: `convertImageFileToWebp` → `convertImageFileToJpeg`, `convertPdfAllPagesToWebp` → `convertPdfAllPagesToJpeg`
- Upload contentType: `'image/webp'` → `'image/jpeg'`
- Fallback canvas: `toDataURL('image/webp', 0.7)` → `toDataURL('image/jpeg', 1.0)`
- Toast/labels: "WebP" → "JPEG"

#### 6. `src/services/dbService.ts` (export)
- Any WebP references in export logic updated to reflect JPEG

All quality parameters set to `1.0` for maximum fidelity. Existing stored WebP files will still display fine in browsers.


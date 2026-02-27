

## Plan: Fix fiche technique in "Créer Article" + multi-file + PDF all pages + delete article image

### Root Cause Analysis

The "Créer un Nouvel Article" dialog in Gestion Devis uses `MultiFournisseurInput` for fiche technique uploads. Two problems:

1. **PDF only converts first page**: `MultiFournisseurInput.handleFicheUpload` calls `convertImageFileToWebp()` which internally uses `convertPdfToWebp()` -- this only renders page 1 of a PDF. The user wants ALL pages converted.
2. **Only one fiche per fournisseur**: Currently stores a single URL string. The user wants to add multiple images/files per fournisseur.
3. **No delete button for article image**: The image upload area in the create dialog has no way to remove a selected image.

### Implementation Steps

#### 1. Update `MultiFournisseurInput` -- multi-file fiche with PDF all-pages support
**File**: `src/components/inventory/MultiFournisseurInput.tsx`

- Change `fiche_technique_url` handling from single URL to array of URLs (JSON string format, same as `products.fiche_technique_url`).
- Replace `handleFicheUpload` to accept multiple files: for images, convert each to WebP; for PDFs, use `convertPdfAllPagesToWebp()` to get all pages as WebP blobs.
- Upload all blobs to storage, collect URLs, serialize as JSON array string.
- Update the UI to show all uploaded fiches as thumbnails with individual delete buttons.
- Update the preview dialog to support gallery navigation (previous/next).
- Add helper functions `parseFicheUrls()` and `serializeFicheUrls()` (reuse pattern from VariantView).
- Change file input to `multiple`.

#### 2. Add delete button for article image in create dialog
**File**: `src/components/devis/DevisForm.tsx`

- In the "Créer un Nouvel Article" dialog (line ~1262), add an X button overlay on the image preview to clear `newArticle.image` back to `null`.
- Only show the X button when an image is already selected.

#### 3. Ensure fiche URLs flow correctly through article creation
**File**: `src/components/devis/DevisForm.tsx`

- In `createNewArticle`, the `f.fiche_technique_url` from `MultiFournisseurInput` already flows into both `product_group_fournisseurs` insert and `products` insert -- this is correct and no change needed here, as long as MultiFournisseurInput correctly sets the URL.

### Technical Details

- **Storage format**: `fiche_technique_url` stores either a single URL string or a JSON array string `["url1","url2"]` -- compatible with existing `parseFicheUrls()` in VariantView.
- **No DB migration needed**: The `fiche_technique_url` column is already `text` type on both `products` and `product_group_fournisseurs` tables.
- **WebP conversion**: Uses existing `convertImageFileToWebp` for images and `convertPdfAllPagesToWebp` for PDFs from `src/lib/imageCompression.ts`.
- **Storage bucket**: `fiches-techniques` (public, already exists).


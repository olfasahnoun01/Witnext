

## Plan: Add Fiche Technique Upload to "Créer Article" Dialog in Gestion Devis

### Changes

#### File: `src/components/devis/DevisForm.tsx`

1. **Add state for fiche technique files**: Add `newArticleFicheFiles: File[]` state and a ref for the file input.

2. **Add file processing function**: `handleArticleFicheUpload` that accepts multiple files (images + PDFs), converts PDFs to per-page WebP using `convertPdfAllPagesToWebp`, converts images via `convertImageFileToWebp`, uploads all blobs to `fiches-techniques` storage bucket, and collects URLs.

3. **Add UI section in the create dialog** (after the MultiFournisseurInput, before Couleur): A file input accepting `image/*,application/pdf` with `multiple`, showing selected file count/thumbnails with remove buttons.

4. **Update `createNewArticle`**: After creating the product group and products, process the fiche files (convert + upload to storage), then update the created products' `fiche_technique_url` with the JSON array of URLs.

5. **Reset fiche state** in `resetNewArticleForm`.

#### Imports to add
- `convertImageFileToWebp`, `convertPdfAllPagesToWebp` from `@/lib/imageCompression`
- `FileText` icon from lucide-react

### Technical Details
- Files uploaded to `fiches-techniques` bucket under `fiches/{timestamp}_{index}.webp`
- URLs stored as JSON array string in `fiche_technique_url` column on both `products` and `product_group_fournisseurs`
- Compatible with existing `parseFicheUrls()` pattern used in VariantView


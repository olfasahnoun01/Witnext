
Implementation plan:

1) Fix the current “still doesn’t work” bug in Ajouter Variante
- Update `handleCreateVariant` in `src/components/devis/DevisForm.tsx` so it always uses the latest selected fiche file(s) (fix stale `useCallback` dependency issue).
- Add strict error handling for:
  - storage upload errors
  - RPC errors (`update_product_fiche_technique`)
- Show failure toast when RPC/upload fails (no silent success).

2) Add multi-file support in Ajouter Variante
- Replace `variantFicheFile: File | null` with `variantFicheFiles: File[]`.
- Change file input to `multiple` and keep accepted types: PDF/JPG/JPEG/PNG/WEBP.
- Add UI feedback for selected files (count + names + remove/reset action).

3) Convert all uploads to WebP before saving
- For image files: use `convertImageFileToWebp(...)`.
- For PDF files: use `convertPdfAllPagesToWebp(...)` and include every page.
- Upload each generated WebP blob to `fiches-techniques` bucket and collect all public URLs.

4) Save all fiche URLs on the created variant record
- After `createVariant(...)` success, call RPC once with serialized payload:
  - single URL => plain string
  - multiple URLs => JSON string array
- Use `update_product_fiche_technique` with `_product_id = result.id`.

5) Compatibility + consistency
- Keep storage format compatible with existing inventory parsing (`VariantView` already supports single URL or JSON array string).
- Keep existing role behavior (users can insert variant; fiche update via secure RPC).

6) Validation and E2E verification
- Validate type/size per file before processing.
- Test end-to-end with role `user`:
  - add variant with 2+ images
  - add variant with multi-page PDF
  - verify all generated images appear on variant fiche line in inventory preview
  - verify error toast appears if upload/RPC fails.

Technical details (for implementation):
- Primary file: `src/components/devis/DevisForm.tsx`
  - state near current `variantFicheFile` declarations
  - upload block inside `handleCreateVariant` (around current RPC call)
  - file input section in Add Variant dialog (`type="file"` area)
- Reuse existing utility:
  - `src/lib/imageCompression.ts`
    - `convertImageFileToWebp`
    - `convertPdfAllPagesToWebp`
- No database schema migration required for this feature (existing `products.fiche_technique_url` text + RPC already supports serialized values).

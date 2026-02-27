
Implementation plan to fix PDF round-trip quality loss (upload PDF → converted images → download as PDF):

1) Update central PDF-to-image conversion (single source of truth)
- File: `src/lib/imageCompression.ts`
- In `convertPdfAllPagesToJpeg`, remove the aggressive 1920px cap for PDF pages.
- Render PDF pages at much higher raster scale (target ~300 DPI equivalent, e.g. `scale: 4` instead of `2`).
- Keep JPEG output at `1.0` quality.
- Add a safety ceiling (very high, e.g. ~5000px) only to avoid browser memory crashes, not to downscale normal pages.
- Keep proportional resize only when safety ceiling is exceeded.

2) Force high-fidelity options at all PDF upload entry points
- File: `src/components/inventory/VariantView.tsx`
- File: `src/components/devis/DevisForm.tsx`
- Wherever `convertPdfAllPagesToJpeg(file)` is called, pass explicit high-quality options (high max dimensions + high render scale + quality 1.0) so all flows use the same fidelity level.

3) Keep PDF export step lossless (already partially done), harden it
- File: `src/components/inventory/VariantView.tsx`
- Keep canvas native-resolution export to PNG and `pdf.addImage(..., 'PNG', ..., 'NONE')`.
- Initialize jsPDF with compression disabled (`compress: false`) to avoid any library-level recompression side effects.
- Keep current fit-to-page logic based on natural dimensions.

4) Add user-facing guardrail for existing low-quality historical files
- Add a clear toast/message when downloading: previously uploaded PDF pages may remain low quality because they were already downscaled during earlier uploads.
- Indicate that re-uploading those PDFs is required to regenerate high-resolution pages.

5) Validation checklist (end-to-end)
- Upload a multi-page PDF with small text and fine lines from VariantView.
- Verify stored page image dimensions are significantly higher than before (not ~1190x1684/1920 cap).
- Download generated PDF and compare zoomed text clarity vs source.
- Repeat same flow in DevisForm (new article + new variant upload paths).

Technical details
- Root cause now is mostly upstream rasterization/downscaling during PDF upload (`scale: 2` + 1920 cap), not only download-time PDF assembly.
- Download step can only preserve what was stored; if upload creates low-res JPEGs, later export cannot recover detail.
- This plan fixes both stages:
  - Upload: higher-resolution rasterization with minimal downscaling.
  - Download: no extra recompression.

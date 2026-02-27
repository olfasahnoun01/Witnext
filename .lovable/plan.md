

## Plan: Remove TVA from article preview dialog when devis is HT

### Changes in `src/components/devis/DevisHistory.tsx`

**1. Table header (line 312)** — Conditionally hide the TVA column header when `!itemsDevis.is_ttc`.

**2. Table body (line 332)** — Conditionally hide the TVA cell per row when `!itemsDevis.is_ttc`.

**3. Sous-total calculation (line 321)** — When `!itemsDevis.is_ttc`, compute sous-total as `prixApresRemise * quantity` (no TVA).

**4. Footer totals (lines 373-382)** — Conditionally hide the TVA row and Total TTC row when `!itemsDevis.is_ttc`.

**5. Final total row (line 390)** — Change label from "Total TTC" to "Total HT" and value from `totalTTC + 1` to `totalNet + 1` when `!itemsDevis.is_ttc`.

**6. ColSpan adjustment (line 353)** — Reduce colSpan by 1 when HT (TVA column removed).


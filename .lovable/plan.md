

## Plan: Remove all TTC references when toggle is HT

When `isTtc === false`, hide every mention of "TTC" from the summary grid and ensure labels only reference HT.

### Changes in `src/components/devis/DevisForm.tsx`

**1. Summary totals grid (lines 1003-1033)**

When `!isTtc`:
- Hide the "TVA" cell (lines 1017-1020)
- Hide the "Total TTC" cell (lines 1021-1024)
- Change the final total label from "Total TTC" to "Total HT" (line 1030)
- Recalculate the final total to be `totalNet + 1` (timbre) instead of `totalTTC + 1`
- Adjust grid columns: use `grid-cols-2 sm:grid-cols-3` when TTC, `grid-cols-2` when HT (fewer cells)

**2. devisTotals calculation (lines 620-634)**

Add a `totalFinalHT` value: `totalNet + 1` so the final line can show the correct HT total when not in TTC mode.

**3. Summary structure when HT:**
- Show: Total HT, Remise, Net HT, Timbre
- Final line: "Total HT" with value `(totalNet + 1).toFixed(3) TND`

**4. Summary structure when TTC (unchanged):**
- Show: Total HT, Remise, Net HT, TVA, Total TTC, Timbre
- Final line: "Total TTC" with value `totalFinal.toFixed(3) TND`


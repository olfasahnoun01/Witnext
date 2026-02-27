

## Plan: Remove TVA from PDF and article preview when devis is HT

### Changes in `src/utils/pdfGenerator.ts`

**1. Items table (lines 518-568)**
- When `!isTTC`: remove the TVA column (`item.tva ?? 19}%`) from each data row (index 5 in the array)
- Remove `'TVA'` from the header row
- Adjust `columnStyles` indices (columns shift left after TVA removal)
- Change `Prix U TTC` label to `Prix U HT` (already done via ternary)
- Change `Sous-total TTC` to `Sous-total HT` (already done via ternary)

**2. Totals section (lines 587-599)**
When `!isTTC`:
- Remove `['TVA', ...]` row
- Remove intermediate `['Total TTC', ...]` row
- Change final row label from `'Total TTC'` to `'Total HT'`
- Use `totalNet + 1` instead of `totalFinal` (which is `totalTTC + 1`)

**3. Bold styling in `didParseCell` (lines 630-634)**
When `!isTTC`: bold `'Net HT'` and `'Total HT'` instead of `'Total TTC'`.

### Changes in `src/components/devis/DevisForm.tsx`

**4. Article preview (lines 944-966)**
Already handled — shows only HT when `!isTtc`. No changes needed here.

**Summary:** 6 targeted edits in `pdfGenerator.ts` to conditionally strip TVA column and TTC totals from the generated PDF document when the devis is in HT mode.


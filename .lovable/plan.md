

## Plan: Hide TVA field when HT mode is selected

When the user toggles the HT/TTC switch to HT (`isTtc === false`), hide the TVA % input field in three places within `DevisForm.tsx`:

### Changes in `src/components/devis/DevisForm.tsx`

1. **Search mode TVA field** (lines 876-883): Wrap the TVA `<div>` with `{isTtc && (...)}` conditional
2. **Manual mode TVA field** (lines 922-929): Same conditional wrapping
3. **Inline edit TVA field** (lines 1057-1064): Same conditional wrapping
4. **Item display TVA info** (line 1080): Hide the `TVA: X%` text in item summary when `!isTtc`
5. **Grid column counts**: Adjust grid column classes where TVA field removal affects layout (lines 894, ~847 area for search mode grid)
6. **Default TVA behavior**: When `!isTtc`, the TVA value should still default to 19% internally for calculations, just hidden from UI


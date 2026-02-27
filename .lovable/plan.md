

## Problem

For **devis sortant en mode TTC**, the user enters a "Prix Vente TTC" (e.g. 1.000 TND). This value is stored as `item.prix_ttc`. But everywhere in the code, `item.prix_ttc` is treated as HT for totals calculation (`lineHT = i.prix_ttc * i.quantity`). So "Total HT" shows 1.000 instead of the correct 0.840 (= 1.000 / 1.19).

The bug exists in **3 places** that all do the same wrong calculation:

## Fix

For sortant + TTC, the real HT = `item.prix_ttc / (1 + tvaRate)`. Apply this in all 3 locations:

### 1. `src/components/devis/DevisForm.tsx` — UI totals (lines 620-635)

Add `devisType` and `isTtc` to the `useMemo` dependencies. For sortant + TTC, compute `lineHT` from TTC:

```typescript
const isSortantTTC = devisType === 'sortant' && isTtc;
devisItems.forEach(i => {
  const tvaRate = (i.tva ?? 19) / 100;
  const lineHT = isSortantTTC
    ? (i.prix_ttc / (1 + tvaRate)) * i.quantity
    : i.prix_ttc * i.quantity;
  // rest stays the same
});
```

### 2. `src/components/GestionDevis.tsx` — Save total_amount (lines 139-146 and 183-189)

Same fix in both `saveDevis` and `updateDevis`: derive HT correctly for sortant+TTC before computing totalTTC.

### 3. `src/utils/pdfGenerator.ts` — PDF generation (lines 518-591)

- **Table data** (line 521): for sortant+TTC, show HT unit price = `item.prix_ttc / (1 + tvaRate)`, and sous-total TTC = `prixApresRemise * qty` (already TTC, no need to multiply by `(1 + tvaRate)` again).
- **Totals section** (line 582): same fix as UI — derive lineHT from TTC for sortant.

### Summary of the rule

```text
If sortant + is_ttc:
  unitTTC = item.prix_ttc          (what user entered)
  unitHT  = unitTTC / (1 + tva)    (derived)
  lineHT  = unitHT * qty
  sousTotal TTC = unitTTC * (1-remise%) * qty
Else:
  keep existing logic (item.prix_ttc treated as HT)
```


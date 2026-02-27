

## Problem

In `addItem()` (line 287 of `DevisForm.tsx`), when adding an article for an entrant devis, the code **always** converts the HT price to TTC:

```typescript
const finalPrixTtc = isEntrant ? itemPrixTtc * (1 + tvaRate) : itemPrixTtc;
```

This runs even when `isTtc` is `false` (HT mode), so the stored unit price becomes a TTC value instead of the real HT value the user entered/selected.

## Fix

**File:** `src/components/devis/DevisForm.tsx`

**Line 287** — Only convert HT→TTC when in TTC mode:

```typescript
const finalPrixTtc = isEntrant && isTtc ? itemPrixTtc * (1 + tvaRate) : itemPrixTtc;
```

This ensures that in HT mode, the prix vente U stays as the real HT value without any TVA conversion.




## Fix: Revert the incorrect unit price division for sortant devis

### File: `src/utils/pdfGenerator.ts`

**Line 520** — Remove the division. `item.prix_ttc` is already the HT base price, so for sortant devis we just display it as-is with the "Prix U HT" label:

```typescript
// Before (wrong):
const prixUnit = (isTTC && devis.type === 'sortant') ? item.prix_ttc / (1 + tvaRate) : item.prix_ttc;

// After (correct):
// Remove prixUnit entirely, just use item.prix_ttc for display (line 532)
```

Simply delete line 520 and revert line 532 back to `item.prix_ttc.toFixed(3)`. The header label "Prix U HT" stays as-is.

**Single line change**, one file.


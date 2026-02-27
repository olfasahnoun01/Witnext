

## Plan: Change "Prix U TTC" to "Prix U HT" for sortant devis in PDF

### File: `src/utils/pdfGenerator.ts`

**Line 539-541** — Update the TTC header row to use "Prix U HT" when `devis.type === 'sortant'`:

```typescript
const headRow = isTTC
  ? ['#', 'Désignation', 'Fournisseur', devis.type === 'sortant' ? 'Prix U HT' : 'Prix U TTC', 'Remise', 'TVA', 'Qté', devis.type === 'sortant' ? 'Sous-total HT' : 'Sous-total TTC']
  : ['#', 'Désignation', 'Fournisseur', 'Prix U HT', 'Remise', 'Qté', 'Sous-total HT'];
```

One edit, one file.


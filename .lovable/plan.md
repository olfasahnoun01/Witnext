
## DONE — Devis sortant pricing fix

### Règle unifiée (implémentée dans `src/lib/devisPricing.ts`)

```text
Si sortant + is_ttc:
  unitTTC = item.prix_ttc          (prix saisi par l'utilisateur = TTC)
  unitHT  = unitTTC / (1 + tva)
  unitTTC_after = unitTTC * (1 - remise%)
  unitHT_after  = unitHT  * (1 - remise%)
  lineTTC = unitTTC_after * qty
  lineHT  = unitHT_after  * qty
  lineTVA = lineTTC - lineHT
Sinon (entrant ou mode HT):
  unitHT = item.prix_ttc            (prix saisi = HT)
  unitTTC = unitHT * (1 + tva)
  ... même logique remise/lignes
```

### Fichiers modifiés
- `src/lib/devisPricing.ts` — helper partagé (computeDevisLine, computeDevisTotals)
- `src/utils/pdfGenerator.ts` — PDF table + totaux utilisent le helper
- `src/components/GestionDevis.tsx` — save/update total_amount via helper
- `src/components/devis/DevisForm.tsx` — devisTotals + affichage articles via helper
- `src/components/devis/DevisHistory.tsx` — colonne Total + popup détail via helper

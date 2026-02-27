
Objectif: remettre le devis sortant en cohérence complète (labels + valeurs + totaux) sans casser l’entrant.

1) Verrouiller une règle unique de calcul pour `sortant + mode TTC`
- Règle cible:
  - `prix_saisi` (champ actuel `item.prix_ttc`) = **Prix U TTC**
  - `Prix U HT` affiché = `prix_saisi / (1 + tvaRate)`
  - `Sous-total TTC` = `(prix_saisi après remise) * quantité`
  - `Sous-total HT` = `(Prix U HT après remise) * quantité`
- Ne pas changer la règle des autres cas (`entrant`, mode HT).

2) Centraliser les calculs dans une fonction utilitaire partagée
- Créer un helper de calcul (ex: `src/lib/devisPricing.ts`) renvoyant, pour une ligne:
  - `unitHT`, `unitTTC`, `unitAfterRemiseHT`, `unitAfterRemiseTTC`, `lineHT`, `lineTVA`, `lineTTC`.
- Remplacer les calculs dupliqués qui utilisent directement `item.prix_ttc` comme HT.

3) Corriger la génération PDF devis sortant
- Fichier: `src/utils/pdfGenerator.ts`
- Ajuster la ligne article:
  - Colonne `Prix U HT` (sortant TTC): afficher `unitHT` (pas `item.prix_ttc` brut).
  - Colonne `Sous-total TTC`: garder TTC.
- Ajuster les totaux PDF:
  - `Total HT`, `TVA`, `Total TTC` calculés depuis la règle unifiée (pas depuis `item.prix_ttc` supposé HT).
- Garder le header demandé:
  - `Prix U HT` pour sortant TTC
  - `Sous-total TTC` (comme tu l’as demandé).

4) Corriger les mêmes incohérences dans l’UI devis
- Fichiers:
  - `src/components/GestionDevis.tsx` (save/update `total_amount`)
  - `src/components/devis/DevisForm.tsx` (bloc totaux et sous-totaux affichés)
  - `src/components/devis/DevisHistory.tsx` (colonne Total + popup détail)
- Appliquer strictement le helper partagé pour éviter les divergences entre écran et PDF.

5) Vérification ciblée avant livraison
- Cas A: Devis sortant TTC, TVA 19%, remise 0:
  - Vérifier `Prix U HT` = TTC / 1.19
  - Vérifier `Sous-total TTC` = TTC * Qté
- Cas B: Devis sortant TTC avec remise:
  - Vérifier que remise impacte correctement HT/TTC et que le total final est aligné partout (formulaire, historique, PDF).
- Cas C: Devis entrant et mode HT:
  - Vérifier absence de régression.

Section technique (référence de calcul)
```text
Si sortant + is_ttc:
  unitTTC = item.prix_ttc
  unitHT  = unitTTC / (1 + tva)
  unitTTC_after = unitTTC * (1 - remise%)
  unitHT_after  = unitHT  * (1 - remise%)
  lineTTC = unitTTC_after * qty
  lineHT  = unitHT_after  * qty
  lineTVA = lineTTC - lineHT
Sinon:
  garder logique existante
```

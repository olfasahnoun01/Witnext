

## Plan: Hide HT/TTC toggle for Devis Entrant, force TTC

### Changes

#### 1. `src/components/devis/DevisForm.tsx` (lines 791-814)
- Wrap the HT/TTC toggle section in a condition: only show when `devisType === 'sortant'`
- When hidden (entrant), the `isTtc` value will be forced to `true` via the parent

#### 2. `src/components/GestionDevis.tsx`
- In `handleTypeChange`: when switching to `'entrant'`, force `setIsTtc(true)`
- In `startEdit`: when loading an entrant devis, force `setIsTtc(true)` regardless of stored value

This ensures:
- Toggle is hidden for devis entrant
- Switching from sortant (HT mode) to entrant automatically sets TTC
- Editing an entrant devis always uses TTC


import type { Devis, DevisItem } from '@/types';
import { computeDevisTotals, resolveFodecEnabled } from '@/lib/devisPricing';

export function normalizeThirdPartyKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

export function mergeDevisItemsFromSources(devisList: Devis[]): DevisItem[] {
  const merged: DevisItem[] = [];
  for (const devis of devisList) {
    for (const item of devis.items) {
      merged.push({
        ...item,
        line_id: item.line_id || `merge-${devis.id}-${merged.length}`,
      });
    }
  }
  return merged;
}

export function validateDevisMergeForBc(devisList: Devis[]): { ok: true } | { ok: false; error: string } {
  if (devisList.length < 2) {
    return { ok: false, error: 'Sélectionnez au moins deux devis.' };
  }
  const notDevis = devisList.filter((d) => d.is_bc || d.is_ba);
  if (notDevis.length > 0) {
    return { ok: false, error: 'Seuls des devis (non BC) peuvent être fusionnés.' };
  }
  const types = new Set(devisList.map((d) => d.type));
  if (types.size > 1) {
    return { ok: false, error: 'Tous les devis doivent être du même type (vente ou achat).' };
  }
  const parties = new Set(devisList.map((d) => normalizeThirdPartyKey(d.third_party_name)));
  if (parties.size > 1) {
    return { ok: false, error: 'Tous les devis doivent concerner le même client ou fournisseur.' };
  }
  const first = devisList[0];
  if (!first.third_party_name?.trim()) {
    return { ok: false, error: 'Le tiers (client/fournisseur) doit être renseigné sur les devis.' };
  }
  return { ok: true };
}

export function buildMergedBcNotes(sourceDevis: Devis[]): string {
  const numbers = sourceDevis.map((d) => d.devis_number).join(', ');
  return `BC fusionné depuis les devis : ${numbers}.`;
}

export function computeMergedTotals(devisList: Devis[], items: DevisItem[], isTtc: boolean) {
  const first = devisList[0];
  const devisType: 'achat' | 'vente' =
    first && (first.type === 'achat' || first.type === 'entrant') ? 'achat' : 'vente';
  return computeDevisTotals(items, false, {
    devisType,
    docType: 'bc',
    isTvaEnabled: isTtc,
    isFodecEnabled: resolveFodecEnabled({ devisType, items }),
  });
}

export function validateBcMergeForFacture(bcList: Devis[]): { ok: true } | { ok: false; error: string } {
  if (bcList.length < 2) {
    return { ok: false, error: 'Sélectionnez au moins deux bons de commande.' };
  }
  const notBc = bcList.filter((d) => !d.is_bc);
  if (notBc.length > 0) {
    return { ok: false, error: 'Seuls des bons de commande peuvent être fusionnés.' };
  }
  if (bcList.some((d) => d.type !== 'vente')) {
    return { ok: false, error: 'La fusion en facture concerne les BC vente (client) uniquement.' };
  }
  const parties = new Set(bcList.map((d) => normalizeThirdPartyKey(d.third_party_name)));
  if (parties.size > 1) {
    return { ok: false, error: 'Tous les BC doivent concerner le même client.' };
  }
  return { ok: true };
}

export function mergeBcItems(bcList: Devis[]): DevisItem[] {
  return mergeDevisItemsFromSources(bcList);
}

export function validateBcMergeForBl(bcList: Devis[]): { ok: true } | { ok: false; error: string } {
  return validateBcMergeForFacture(bcList);
}

export function buildMergedBlNotes(sourceBc: Devis[]): string {
  const numbers = sourceBc.map((d) => d.devis_number).join(', ');
  return `BL fusionné depuis les BC : ${numbers}.`;
}

export function validateBlMergeForFacture(blList: Devis[]): { ok: true } | { ok: false; error: string } {
  if (blList.length < 2) {
    return { ok: false, error: 'Sélectionnez au moins deux bons de livraison.' };
  }
  const notBl = blList.filter((d) => !d.is_bl);
  if (notBl.length > 0) {
    return { ok: false, error: 'Seuls des bons de livraison peuvent être fusionnés.' };
  }
  if (blList.some((d) => d.type !== 'vente')) {
    return { ok: false, error: 'La fusion en facture concerne les BL vente (client) uniquement.' };
  }
  const parties = new Set(blList.map((d) => normalizeThirdPartyKey(d.third_party_name)));
  if (parties.size > 1) {
    return { ok: false, error: 'Tous les BL doivent concerner le même client.' };
  }
  return { ok: true };
}

export function mergeBlItems(blList: Devis[]): DevisItem[] {
  return mergeDevisItemsFromSources(blList);
}

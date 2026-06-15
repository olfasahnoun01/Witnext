import type { DevisItem } from '@/types';
import type { ClientTvaStatus } from '@/config/sectionThemes';

/** Client / fournisseur exonéré de TVA — aucune TVA sur le devis. */
export function isPartyExonereDeTva(status: ClientTvaStatus | string | null | undefined): boolean {
  return status === 'exonere';
}

/** Taux TVA par défaut sur une nouvelle ligne selon le statut du tiers. */
export function defaultDevisLineTvaForParty(
  status: ClientTvaStatus | string | null | undefined
): number {
  return isPartyExonereDeTva(status) ? 0 : 19;
}

/** Mode TTC par défaut : assujetti → TTC, exonéré → HT. */
export function defaultDevisPricingModeIsTtc(
  status: ClientTvaStatus | string | null | undefined
): boolean {
  return !isPartyExonereDeTva(status);
}

export function applyPartyTvaPolicyToItems(
  items: DevisItem[],
  status: ClientTvaStatus | string | null | undefined
): DevisItem[] {
  if (isPartyExonereDeTva(status)) {
    return items.map((item) => ({ ...item, tva: 0 }));
  }
  return items.map((item) => {
    const rate = item.tva ?? 0;
    return { ...item, tva: rate > 0 ? rate : 19 };
  });
}

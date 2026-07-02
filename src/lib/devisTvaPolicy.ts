import type { ClientTvaStatus } from '@/config/sectionThemes';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import type { DevisItem } from '@/types';

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

/** Resolve client TVA status from the clients table (exact name match, active company). */
export async function fetchClientTvaStatusByName(
  clientName: string | null | undefined
): Promise<ClientTvaStatus | null> {
  const trimmed = clientName?.trim();
  if (!trimmed) return null;

  const cid = getActiveCompanyId();
  let query = supabase.from('clients').select('nom, tva_status');
  if (cid) query = query.eq('company_id', cid);
  const { data, error } = await query;
  if (error || !data?.length) return null;

  const normalized = trimmed.toLowerCase();
  const match = data.find((row) => row.nom?.trim().toLowerCase() === normalized);
  if (!match) return null;
  return (match.tva_status as ClientTvaStatus) || 'assujetti';
}

/** Apply client TVA policy before persisting a vente devis / BC / BL. */
export async function resolveDevisPartyTvaPersistence(input: {
  devisType: 'achat' | 'vente';
  thirdPartyName: string | null;
  items: DevisItem[];
  isTtc: boolean;
}): Promise<{ items: DevisItem[]; isTtc: boolean }> {
  if (input.devisType !== 'vente') {
    return { items: input.items, isTtc: input.isTtc };
  }

  const status = await fetchClientTvaStatusByName(input.thirdPartyName);
  if (!status) {
    return { items: input.items, isTtc: input.isTtc };
  }

  return {
    items: applyPartyTvaPolicyToItems(input.items, status),
    isTtc: isPartyExonereDeTva(status) ? false : input.isTtc,
  };
}

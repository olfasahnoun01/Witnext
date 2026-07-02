import type { ClientTvaStatus } from '@/config/sectionThemes';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import type { DevisItem } from '@/types';

export interface DevisFormCommitOptions {
  items: DevisItem[];
  isTtc: boolean;
  partyTvaStatus?: ClientTvaStatus | null;
}

/** Client / fournisseur exonéré de TVA — aucune TVA sur le devis. */
export function isPartyExonereDeTva(status: ClientTvaStatus | string | null | undefined): boolean {
  return status === 'exonere';
}

export function isVenteCommercialType(type: string | null | undefined): boolean {
  return type === 'vente' || type === 'sortant';
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

function normalizePartyLookup(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Resolve client TVA status from the clients table (name or matricule fiscale). */
export async function fetchClientTvaStatusByParty(
  clientName: string | null | undefined,
  matriculeFiscale?: string | null
): Promise<ClientTvaStatus | null> {
  const trimmedName = clientName?.trim();
  const trimmedMf = matriculeFiscale?.trim();
  if (!trimmedName && !trimmedMf) return null;

  const cid = getActiveCompanyId();
  let query = supabase.from('clients').select('nom, tva_status, matricule_fiscale');
  if (cid) query = query.eq('company_id', cid);
  const { data, error } = await query;
  if (error || !data?.length) return null;

  const normalizedName = normalizePartyLookup(trimmedName);
  const normalizedMf = normalizePartyLookup(trimmedMf);

  const match =
    (normalizedMf
      ? data.find((row) => normalizePartyLookup(row.matricule_fiscale) === normalizedMf)
      : undefined) ??
    (normalizedName
      ? data.find((row) => normalizePartyLookup(row.nom) === normalizedName)
      : undefined);

  if (!match) return null;
  return (match.tva_status as ClientTvaStatus) || 'assujetti';
}

/** @deprecated Use fetchClientTvaStatusByParty */
export async function fetchClientTvaStatusByName(
  clientName: string | null | undefined
): Promise<ClientTvaStatus | null> {
  return fetchClientTvaStatusByParty(clientName);
}

export function devisItemsHavePositiveTva(items: DevisItem[]): boolean {
  return items.some((item) => (item.tva ?? 0) > 0);
}

/** Apply client TVA policy before persisting a vente devis / BC / BL. */
export async function resolveDevisPartyTvaPersistence(input: {
  devisType: string;
  thirdPartyName: string | null;
  thirdPartyTaxId?: string | null;
  items: DevisItem[];
  isTtc: boolean;
  /** When the form already resolved the client (exonéré / assujetti). */
  partyTvaStatus?: ClientTvaStatus | string | null;
}): Promise<{ items: DevisItem[]; isTtc: boolean }> {
  if (!isVenteCommercialType(input.devisType)) {
    return { items: input.items, isTtc: input.isTtc };
  }

  const status =
    input.partyTvaStatus ??
    (await fetchClientTvaStatusByParty(input.thirdPartyName, input.thirdPartyTaxId));

  if (!status) {
    if (!input.isTtc && !devisItemsHavePositiveTva(input.items)) {
      return { items: input.items, isTtc: false };
    }
    return { items: input.items, isTtc: input.isTtc };
  }

  return {
    items: applyPartyTvaPolicyToItems(input.items, status),
    isTtc: isPartyExonereDeTva(status) ? false : input.isTtc,
  };
}

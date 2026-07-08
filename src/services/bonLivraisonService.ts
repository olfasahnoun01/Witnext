import { supabase } from '@/integrations/supabase/client';
import { parseAttachmentUrls } from '@/lib/commercialAttachments';
import {
  buildMergedBlNotes,
  mergeBcItems,
  validateBcMergeForBl,
} from '@/lib/mergeCommercialDocuments';
import { supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import type { BonCommande, Devis } from '@/types';
import { computeSavedDocumentTotals } from '@/lib/devisPricing';
import { isMissingDevisColumnError, resolveBcIdFromBlRow } from '@/modules/flux/services/devisFluxFields';
import { requireActiveCompanyId } from '@/lib/activeCompany';

type BlBcLinkRow = {
  source_bc_id?: number | null;
  source_bc_ids?: unknown;
  source_devis_id?: number | null;
  is_bl?: boolean;
};

function collectBcIdsFromBlRow(row: BlBcLinkRow): number[] {
  const ids: number[] = [];
  if (typeof row.source_bc_id === 'number' && row.source_bc_id > 0) {
    ids.push(row.source_bc_id);
  }
  if (Array.isArray(row.source_bc_ids)) {
    for (const id of row.source_bc_ids) {
      if (typeof id === 'number' && id > 0) ids.push(id);
    }
  }
  const fallback = resolveBcIdFromBlRow(row);
  if (ids.length === 0 && fallback != null) ids.push(fallback);
  return ids;
}

async function fetchBlBcLinkRows(): Promise<BlBcLinkRow[]> {
  const full = await supabaseQueryWithAuthRetry(() =>
    supabase
      .from('devis')
      .select('source_bc_id, source_bc_ids, source_devis_id, is_bl')
      .eq('is_bl', true)
      .eq('type', 'vente')
  );
  if (!full.error) return (full.data ?? []) as BlBcLinkRow[];
  if (isMissingDevisColumnError(full.error.message)) {
    const lite = await supabaseQueryWithAuthRetry(() =>
      supabase
        .from('devis')
        .select('source_devis_id, is_bl')
        .eq('is_bl', true)
        .eq('type', 'vente')
    );
    if (lite.error) {
      console.warn('[bonLivraisonService] fetchBlBcLinkRows:', lite.error.message);
      return [];
    }
    return (lite.data ?? []) as BlBcLinkRow[];
  }
  console.warn('[bonLivraisonService] fetchBlBcLinkRows:', full.error.message);
  return [];
}

/** BC vente déjà convertis en bon de livraison. */
export async function fetchBcIdsHavingBonLivraisonVente(): Promise<Set<number>> {
  const rows = await fetchBlBcLinkRows();
  const set = new Set<number>();
  for (const row of rows) {
    for (const id of collectBcIdsFromBlRow(row)) {
      set.add(id);
    }
  }
  return set;
}

async function blExistsForBcId(bcId: number): Promise<boolean> {
  const ids = await fetchBcIdsHavingBonLivraisonVente();
  return ids.has(bcId);
}

export type CreateBlFromBcResult =
  | { success: true; blId: number; blNumber: string }
  | { success: false; error: string };

async function generateNextBlNumber(): Promise<string> {
  const companyId = requireActiveCompanyId();
  const prefix = 'BLS-';
  const { data, error } = await supabase
    .from('devis')
    .select('devis_number')
    .eq('company_id', companyId)
    .eq('is_bl', true)
    .ilike('devis_number', `${prefix}%`);

  if (error) throw error;

  let maxNum = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (const row of data || []) {
    const m = String((row as { devis_number: string }).devis_number).match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
}

async function insertBonLivraisonDevis(
  base: Record<string, unknown>,
  bcIds: number[]
): Promise<{ id: number } | { error: string }> {
  const withBcLink = {
    ...base,
    source_bc_id: bcIds[0] ?? null,
    source_bc_ids: bcIds.length > 1 ? bcIds : null,
  };

  const full = await supabase.from('devis').insert(withBcLink as never).select('id').single();
  if (!full.error && full.data) return full.data as { id: number };
  if (full.error && isMissingDevisColumnError(full.error.message)) {
    const legacy = await supabase
      .from('devis')
      .insert({
        ...base,
        source_devis_id: bcIds[0] ?? null,
      } as never)
      .select('id')
      .single();
    if (legacy.error || !legacy.data) {
      return { error: legacy.error?.message || full.error.message };
    }
    return legacy.data as { id: number };
  }
  return { error: full.error?.message || 'Insertion BL refusée' };
}

export async function createBonLivraisonFromBonCommandeVente(
  bc: BonCommande
): Promise<CreateBlFromBcResult> {
  if (bc.type !== 'vente') {
    return { success: false, error: 'Le bon de livraison ne peut être créé que depuis un BC client (vente).' };
  }

  if (await blExistsForBcId(bc.id)) {
    return { success: false, error: `Un BL existe déjà pour le BC ${bc.devis_number}.` };
  }

  let blNumber: string;
  try {
    blNumber = await generateNextBlNumber();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Numérotation BL impossible';
    return { success: false, error: msg };
  }

  const totals = computeSavedDocumentTotals(bc);
  const recomputed = Number(totals.totalFinal.toFixed(3));
  // Recompute from lines (respects HT/TTC + FODEC); fall back to the stored
  // amount only for legacy rows that have no line items to recompute from.
  const totalAmount =
    bc.items?.length ? recomputed : Number(bc.total_amount) > 0 ? Number(bc.total_amount) : recomputed;

  const { data: auth } = await supabase.auth.getUser();
  let companyId: string;
  try {
    companyId = requireActiveCompanyId();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Aucune société active sélectionnée.',
    };
  }

  const base = {
    devis_number: blNumber,
    company_id: companyId,
    devis_date: new Date().toISOString().split('T')[0],
    type: 'vente',
    third_party_name: bc.third_party_name,
    third_party_address: bc.third_party_address,
    third_party_tax_id: bc.third_party_tax_id,
    third_party_phone: bc.third_party_phone,
    items: JSON.parse(JSON.stringify(bc.items)),
    total_amount: totalAmount,
    notes: `Généré depuis le bon de commande ${bc.devis_number}.`,
    is_ttc: bc.is_ttc,
    is_bc: false,
    is_ba: false,
    is_bl: true,
    attachment_urls: parseAttachmentUrls(bc.attachment_urls),
    status: 'confirmé',
    created_by: auth.user?.id ?? null,
  };

  const inserted = await insertBonLivraisonDevis(base, [bc.id]);
  if ('error' in inserted) {
    return { success: false, error: inserted.error };
  }

  return { success: true, blId: inserted.id, blNumber };
}

/** Fusionne plusieurs BC vente (même client) en un seul bon de livraison. */
export async function createBonLivraisonFromMultipleBonsCommandeVente(
  bcList: BonCommande[]
): Promise<CreateBlFromBcResult> {
  const check = validateBcMergeForBl(bcList);
  if (!check.ok) return { success: false, error: check.error };

  for (const bc of bcList) {
    if (await blExistsForBcId(bc.id)) {
      return {
        success: false,
        error: `Le BC ${bc.devis_number} est déjà lié à un bon de livraison.`,
      };
    }
  }

  const primary = bcList[0];
  const mergedItems = mergeBcItems(bcList);
  const totals = computeSavedDocumentTotals({ ...primary, items: mergedItems });
  const totalAmount = totals.totalFinal;
  const mergedAttachments = bcList.flatMap((b) => parseAttachmentUrls(b.attachment_urls));

  let blNumber: string;
  try {
    blNumber = await generateNextBlNumber();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Numérotation BL impossible';
    return { success: false, error: msg };
  }

  const { data: auth } = await supabase.auth.getUser();
  let companyId: string;
  try {
    companyId = requireActiveCompanyId();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Aucune société active sélectionnée.',
    };
  }

  const base = {
    devis_number: blNumber,
    company_id: companyId,
    devis_date: new Date().toISOString().split('T')[0],
    type: 'vente',
    third_party_name: primary.third_party_name,
    third_party_address: primary.third_party_address,
    third_party_tax_id: primary.third_party_tax_id,
    third_party_phone: primary.third_party_phone,
    items: JSON.parse(JSON.stringify(mergedItems)),
    total_amount: totalAmount,
    notes: buildMergedBlNotes(bcList),
    is_ttc: primary.is_ttc,
    is_bc: false,
    is_ba: false,
    is_bl: true,
    attachment_urls: mergedAttachments,
    status: 'confirmé',
    created_by: auth.user?.id ?? null,
  };

  const inserted = await insertBonLivraisonDevis(
    base,
    bcList.map((b) => b.id)
  );
  if ('error' in inserted) {
    return { success: false, error: inserted.error };
  }

  return { success: true, blId: inserted.id, blNumber };
}

export type BonLivraison = Devis;

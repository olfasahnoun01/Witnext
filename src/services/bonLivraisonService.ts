import { supabase } from '@/integrations/supabase/client';
import { parseAttachmentUrls } from '@/lib/commercialAttachments';
import {
  buildMergedBlNotes,
  mergeBcItems,
  validateBcMergeForBl,
} from '@/lib/mergeCommercialDocuments';
import { supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import type { BonCommande, Devis } from '@/types';
import { computeDevisTotals } from '@/lib/devisPricing';

function collectBcIdsFromBlRow(row: {
  source_bc_id: number | null;
  source_bc_ids?: unknown;
}): number[] {
  const ids: number[] = [];
  if (typeof row.source_bc_id === 'number' && row.source_bc_id > 0) {
    ids.push(row.source_bc_id);
  }
  if (Array.isArray(row.source_bc_ids)) {
    for (const id of row.source_bc_ids) {
      if (typeof id === 'number' && id > 0) ids.push(id);
    }
  }
  return ids;
}

/** BC vente déjà convertis en bon de livraison. */
export async function fetchBcIdsHavingBonLivraisonVente(): Promise<Set<number>> {
  const { data, error } = await supabaseQueryWithAuthRetry(() =>
    supabase
      .from('devis')
      .select('source_bc_id, source_bc_ids')
      .eq('is_bl', true)
      .eq('type', 'vente')
  );

  if (error) {
    console.warn('[bonLivraisonService] fetchBcIdsHavingBonLivraisonVente:', error.message);
    return new Set();
  }
  const set = new Set<number>();
  for (const row of data || []) {
    for (const id of collectBcIdsFromBlRow(row as { source_bc_id: number | null; source_bc_ids?: unknown })) {
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
  const prefix = 'BLS-';
  const { data, error } = await supabase
    .from('devis')
    .select('devis_number')
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

  const totals = computeDevisTotals(bc.items, false);
  const totalAmount =
    Number(bc.total_amount) > 0 ? Number(bc.total_amount) : Number(totals.totalFinal.toFixed(3));

  const { data: auth } = await supabase.auth.getUser();

  const { data: inserted, error: insErr } = await supabase
    .from('devis')
    .insert({
      devis_number: blNumber,
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
      source_bc_id: bc.id,
      source_bc_ids: null,
      attachment_urls: parseAttachmentUrls(bc.attachment_urls),
      status: 'confirmé',
      created_by: auth.user?.id ?? null,
    } as never)
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: insErr?.message || 'Insertion BL refusée' };
  }

  return { success: true, blId: (inserted as { id: number }).id, blNumber };
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
  const totals = computeDevisTotals(mergedItems, false);
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

  const { data: inserted, error: insErr } = await supabase
    .from('devis')
    .insert({
      devis_number: blNumber,
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
      source_bc_id: primary.id,
      source_bc_ids: bcList.map((b) => b.id),
      attachment_urls: mergedAttachments,
      status: 'confirmé',
      created_by: auth.user?.id ?? null,
    } as never)
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: insErr?.message || 'Insertion BL refusée' };
  }

  return { success: true, blId: (inserted as { id: number }).id, blNumber };
}

export type BonLivraison = Devis;

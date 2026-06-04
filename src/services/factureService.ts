import { supabase } from '@/integrations/supabase/client';
import { parseAttachmentUrls } from '@/lib/commercialAttachments';
import { mergeBlItems, validateBlMergeForFacture } from '@/lib/mergeCommercialDocuments';
import type { BonLivraison } from '@/services/bonLivraisonService';
import { supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import { computeDevisTotals } from '@/lib/devisPricing';

const FACTURE_NUM_PREFIX = () => {
  const y = new Date().getFullYear();
  return `FAC-${y}-`;
};

/**
 * Next unique facture number for the current year (FAC-YYYY-00001).
 */
export async function generateNextFactureNumero(): Promise<string> {
  const prefix = FACTURE_NUM_PREFIX();
  const { data, error } = await supabase
    .from('factures')
    .select('numero')
    .ilike('numero', `${prefix}%`);

  if (error) throw error;

  let maxSeq = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i');
  for (const row of data || []) {
    const m = String((row as { numero: string }).numero).match(re);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

function collectBlIdsFromFactureRow(row: {
  source_bl_id: number | null;
  source_bl_ids?: unknown;
  source_bc_id?: number | null;
  source_bc_ids?: unknown;
}): number[] {
  const ids: number[] = [];
  if (typeof row.source_bl_id === 'number' && row.source_bl_id > 0) {
    ids.push(row.source_bl_id);
  }
  if (Array.isArray(row.source_bl_ids)) {
    for (const id of row.source_bl_ids) {
      if (typeof id === 'number' && id > 0) ids.push(id);
    }
  }
  return ids;
}

/** BL vente déjà convertis en facture. */
export async function fetchBlIdsHavingFactureVente(): Promise<Set<number>> {
  const { data, error } = await supabaseQueryWithAuthRetry(() =>
    supabase.from('factures').select('source_bl_id, source_bl_ids').eq('type', 'vente')
  );

  if (error) {
    console.warn('[factureService] fetchBlIdsHavingFactureVente:', error.message);
    return new Set();
  }
  const set = new Set<number>();
  for (const row of data || []) {
    for (const id of collectBlIdsFromFactureRow(row as {
      source_bl_id: number | null;
      source_bl_ids?: unknown;
    })) {
      set.add(id);
    }
  }
  return set;
}

async function factureExistsForBlId(blId: number): Promise<boolean> {
  const ids = await fetchBlIdsHavingFactureVente();
  return ids.has(blId);
}

export type CreateFactureFromBcResult =
  | { success: true; factureId: string; numero: string }
  | { success: false; error: string };

/**
 * Inserts a row in `public.factures` from a vente bon de livraison (`devis` with is_bl).
 */
export async function createFactureFromBonLivraisonVente(bl: BonLivraison): Promise<CreateFactureFromBcResult> {
  if (bl.type !== 'vente' || !bl.is_bl) {
    return { success: false, error: 'La facture de vente ne peut être générée que depuis un bon de livraison client.' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('factures')
    .select('id, numero')
    .eq('source_bl_id', bl.id)
    .eq('type', 'vente')
    .maybeSingle();

  if (exErr) {
    return { success: false, error: exErr.message };
  }
  if (existing) {
    return {
      success: false,
      error: `Une facture existe déjà pour ce BL (${(existing as { numero: string }).numero}).`,
    };
  }

  let numero: string;
  try {
    numero = await generateNextFactureNumero();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Numérotation facture impossible';
    return { success: false, error: msg };
  }

  const totals = computeDevisTotals(bl.items, false);
  const totalAmount =
    Number(bl.total_amount) > 0 ? Number(bl.total_amount) : Number(totals.totalFinal.toFixed(3));

  const dateCreation = (bl.devis_date || '').slice(0, 10) || new Date().toISOString().split('T')[0];
  const due = new Date(dateCreation);
  due.setDate(due.getDate() + 30);
  const dateEcheance = due.toISOString().slice(0, 10);

  const { data: auth } = await supabase.auth.getUser();

  const { data: inserted, error: insErr } = await supabase
    .from('factures')
    .insert({
      numero,
      type: 'vente',
      date_creation: dateCreation,
      date_echeance: dateEcheance,
      third_party_name: bl.third_party_name,
      third_party_address: bl.third_party_address,
      third_party_tax_id: bl.third_party_tax_id,
      third_party_phone: bl.third_party_phone,
      items: bl.items as unknown as Record<string, unknown>,
      total_amount: totalAmount,
      status: 'brouillon',
      is_ttc: bl.is_ttc,
      source_bl_id: bl.id,
      notes: `Généré depuis le bon de livraison ${bl.devis_number}.`,
      created_by: auth.user?.id ?? null,
    } as never)
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: insErr?.message || 'Insertion facture refusée' };
  }

  return { success: true, factureId: (inserted as { id: string }).id, numero };
}

/**
 * Fusionne plusieurs BL vente (même client) en une seule facture.
 */
export async function createFactureFromMultipleBonsLivraisonVente(
  blList: BonLivraison[]
): Promise<CreateFactureFromBcResult> {
  const check = validateBlMergeForFacture(blList);
  if (!check.ok) return { success: false, error: check.error };

  for (const bl of blList) {
    if (await factureExistsForBlId(bl.id)) {
      return {
        success: false,
        error: `Le BL ${bl.devis_number} est déjà lié à une facture.`,
      };
    }
  }

  const primary = blList[0];
  const mergedItems = mergeBlItems(blList);
  const totals = computeDevisTotals(mergedItems, false);
  const totalAmount = totals.totalFinal;

  let numero: string;
  try {
    numero = await generateNextFactureNumero();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Numérotation facture impossible';
    return { success: false, error: msg };
  }

  const dateCreation = (primary.devis_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const due = new Date(dateCreation);
  due.setDate(due.getDate() + 30);

  const blNumbers = blList.map((b) => b.devis_number).join(', ');
  const mergedAttachments = blList.flatMap((b) => parseAttachmentUrls(b.attachment_urls));

  const { data: auth } = await supabase.auth.getUser();

  const { data: inserted, error: insErr } = await supabase
    .from('factures')
    .insert({
      numero,
      type: 'vente',
      date_creation: dateCreation,
      date_echeance: due.toISOString().slice(0, 10),
      third_party_name: primary.third_party_name,
      third_party_address: primary.third_party_address,
      third_party_tax_id: primary.third_party_tax_id,
      third_party_phone: primary.third_party_phone,
      items: mergedItems as unknown as Record<string, unknown>,
      total_amount: totalAmount,
      status: 'brouillon',
      is_ttc: primary.is_ttc,
      source_bl_id: primary.id,
      source_bl_ids: blList.map((b) => b.id),
      attachment_urls: mergedAttachments,
      notes: `Facture fusionnée depuis les BL : ${blNumbers}.`,
      created_by: auth.user?.id ?? null,
    } as never)
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: insErr?.message || 'Insertion facture refusée' };
  }

  return { success: true, factureId: (inserted as { id: string }).id, numero };
}

export type DeleteFactureResult = { success: true } | { success: false; error: string };

/** Supprime une facture de vente par identifiant. */
export async function deleteFactureVente(factureId: string): Promise<DeleteFactureResult> {
  const { error } = await supabase.from('factures').delete().eq('id', factureId).eq('type', 'vente');

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

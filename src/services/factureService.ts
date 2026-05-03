import { supabase } from '@/integrations/supabase/client';
import type { BonCommande } from '@/types';
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

export async function fetchBcIdsHavingFactureVente(): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('factures')
    .select('source_bc_id')
    .eq('type', 'vente')
    .not('source_bc_id', 'is', null);

  if (error) {
    console.warn('[factureService] fetchBcIdsHavingFactureVente:', error.message);
    return new Set();
  }
  return new Set(
    (data || [])
      .map((r: { source_bc_id: number | null }) => r.source_bc_id)
      .filter((id): id is number => typeof id === 'number' && id > 0)
  );
}

export type CreateFactureFromBcResult =
  | { success: true; factureId: string; numero: string }
  | { success: false; error: string };

/**
 * Inserts a row in `public.factures` from a vente bon de commande (`devis` with is_bc).
 */
export async function createFactureFromBonCommandeVente(bc: BonCommande): Promise<CreateFactureFromBcResult> {
  if (bc.type !== 'vente') {
    return { success: false, error: 'La facture de vente ne peut être générée que depuis un BC client (vente).' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('factures')
    .select('id, numero')
    .eq('source_bc_id', bc.id)
    .eq('type', 'vente')
    .maybeSingle();

  if (exErr) {
    return { success: false, error: exErr.message };
  }
  if (existing) {
    return {
      success: false,
      error: `Une facture existe déjà pour ce BC (${(existing as { numero: string }).numero}).`,
    };
  }

  let numero: string;
  try {
    numero = await generateNextFactureNumero();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Numérotation facture impossible';
    return { success: false, error: msg };
  }

  const totals = computeDevisTotals(bc.items, bc.is_ttc);
  const totalAmount =
    Number(bc.total_amount) > 0 ? Number(bc.total_amount) : Number(totals.totalFinal.toFixed(3));

  const dateCreation = (bc.devis_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
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
      third_party_name: bc.third_party_name,
      third_party_address: bc.third_party_address,
      third_party_tax_id: bc.third_party_tax_id,
      third_party_phone: bc.third_party_phone,
      items: bc.items as unknown as Record<string, unknown>,
      total_amount: totalAmount,
      status: 'brouillon',
      is_ttc: bc.is_ttc,
      source_bc_id: bc.id,
      notes: `Généré depuis le bon de commande ${bc.devis_number}.`,
      created_by: auth.user?.id ?? null,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: insErr?.message || 'Insertion facture refusée' };
  }

  return { success: true, factureId: (inserted as { id: string }).id, numero };
}

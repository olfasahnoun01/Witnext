import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId, requireActiveCompanyId, withCompany } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import {
  markLegacyImportCompleted,
  readLegacyFuelCardHistory,
  readLegacyFuelCards,
  resolveLegacyConducteurId,
  shouldAttemptLegacyImport,
  type EmployeeNameLookup,
  type LegacyFuelCardHistoryType,
} from '@/lib/fuelCardLegacyImport';

export type FuelCardHistoryType = 'creation' | 'recharge';

export interface FuelCardView {
  id: string;
  numCarte: string;
  conducteur: string;
  conducteurId: string | null;
  solde: number;
}

export interface FuelCardHistoryView {
  id: string;
  cardId: string;
  type: FuelCardHistoryType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

type FuelCardRow = {
  id: string;
  num_carte: string;
  solde: number;
  conducteur_id: string | null;
  employees?: { prenom: string; nom: string } | null;
};

type FuelCardHistoryRow = {
  id: string;
  card_id: string;
  type: FuelCardHistoryType;
  amount: number;
  balance_after: number;
  created_at: string;
};

function formatConducteurName(employee: { prenom: string; nom: string } | null | undefined): string {
  if (!employee) return '—';
  return `${employee.prenom} ${employee.nom}`.trim() || '—';
}

export function mapFuelCardRow(row: FuelCardRow): FuelCardView {
  return {
    id: row.id,
    numCarte: row.num_carte,
    conducteur: formatConducteurName(row.employees),
    conducteurId: row.conducteur_id,
    solde: Number(row.solde) || 0,
  };
}

export function mapFuelCardHistoryRow(row: FuelCardHistoryRow): FuelCardHistoryView {
  return {
    id: row.id,
    cardId: row.card_id,
    type: row.type,
    amount: Number(row.amount) || 0,
    balanceAfter: Number(row.balance_after) || 0,
    createdAt: row.created_at,
  };
}

export async function fetchFuelCards(): Promise<{ ok: boolean; cards: FuelCardView[]; error?: string }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { ok: true, cards: [] };

  let q = supabase
    .from('fuel_cards')
    .select('id, num_carte, solde, conducteur_id, employees(prenom, nom)')
    .order('created_at', { ascending: false });
  q = filterByCompanyId(q, companyId);

  const { data, error } = await q;
  if (error) return { ok: false, cards: [], error: error.message };

  const cards = ((data ?? []) as FuelCardRow[]).map(mapFuelCardRow);
  return { ok: true, cards };
}

export async function fetchFuelCardHistory(
  cardId: string
): Promise<{ ok: boolean; entries: FuelCardHistoryView[]; error?: string }> {
  const { data, error } = await supabase
    .from('fuel_card_history')
    .select('id, card_id, type, amount, balance_after, created_at')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, entries: [], error: error.message };
  return {
    ok: true,
    entries: ((data ?? []) as FuelCardHistoryRow[]).map(mapFuelCardHistoryRow),
  };
}

async function insertFuelCardHistory(
  cardId: string,
  type: FuelCardHistoryType,
  amount: number,
  balanceAfter: number,
  createdAt?: string
): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = {
    card_id: cardId,
    type,
    amount,
    balance_after: balanceAfter,
  };
  if (createdAt) payload.created_at = createdAt;

  const { error } = await supabase.from('fuel_card_history').insert(payload as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createFuelCard(input: {
  numCarte: string;
  conducteurId: string | null;
  solde: number;
}): Promise<{ ok: boolean; card?: FuelCardView; error?: string }> {
  requireActiveCompanyId();
  const numCarte = input.numCarte.trim();
  if (!numCarte) return { ok: false, error: 'Numéro de carte requis' };

  const { data, error } = await supabase
    .from('fuel_cards')
    .insert(
      withCompany({
        num_carte: numCarte,
        solde: input.solde,
        conducteur_id: input.conducteurId,
        status: 'active',
      }) as never
    )
    .select('id, num_carte, solde, conducteur_id, employees(prenom, nom)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ce numéro de carte existe déjà pour cette société' };
    }
    return { ok: false, error: error.message };
  }

  const card = mapFuelCardRow(data as FuelCardRow);
  const historyResult = await insertFuelCardHistory(card.id, 'creation', input.solde, input.solde);
  if (!historyResult.ok) {
    console.error('[fuelCardRepository] create history failed:', historyResult.error);
  }

  return { ok: true, card };
}

export async function rechargeFuelCard(
  cardId: string,
  amount: number
): Promise<{ ok: boolean; card?: FuelCardView; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Montant invalide' };
  }

  const companyId = requireActiveCompanyId();
  let fetchQ = supabase
    .from('fuel_cards')
    .select('id, num_carte, solde, conducteur_id, employees(prenom, nom)')
    .eq('id', cardId);
  fetchQ = filterByCompanyId(fetchQ, companyId);

  const { data: current, error: fetchError } = await fetchQ.maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!current) return { ok: false, error: 'Carte introuvable' };

  const balanceAfter = Number((current as FuelCardRow).solde) + amount;
  let updateQ = supabase.from('fuel_cards').update({ solde: balanceAfter } as never).eq('id', cardId);
  updateQ = filterByCompanyId(updateQ, companyId);

  const { data: updated, error: updateError } = await updateQ
    .select('id, num_carte, solde, conducteur_id, employees(prenom, nom)')
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: 'Carte introuvable ou droits insuffisants' };

  const historyResult = await insertFuelCardHistory(cardId, 'recharge', amount, balanceAfter);
  if (!historyResult.ok) {
    return { ok: false, error: historyResult.error };
  }

  return { ok: true, card: mapFuelCardRow(updated as FuelCardRow) };
}

export async function deleteFuelCard(cardId: string): Promise<{ ok: boolean; error?: string }> {
  const companyId = requireActiveCompanyId();
  let q = supabase.from('fuel_cards').delete().eq('id', cardId);
  q = filterByCompanyId(q, companyId);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function importLegacyFuelCardsIfNeeded(
  employees: EmployeeNameLookup[]
): Promise<{ imported: number; error?: string }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { imported: 0 };

  const existing = await fetchFuelCards();
  if (!existing.ok) return { imported: 0, error: existing.error };
  if (!shouldAttemptLegacyImport(companyId, existing.cards.length)) {
    return { imported: 0 };
  }

  const legacyCards = readLegacyFuelCards();
  const legacyHistory = readLegacyFuelCardHistory();
  const historyByLegacyCardId = new Map<string, typeof legacyHistory>();
  for (const entry of legacyHistory) {
    const list = historyByLegacyCardId.get(entry.cardId) ?? [];
    list.push(entry);
    historyByLegacyCardId.set(entry.cardId, list);
  }

  let imported = 0;
  for (const legacy of legacyCards) {
    const conducteurId = resolveLegacyConducteurId(legacy.conducteur, employees);
    const { data, error } = await supabase
      .from('fuel_cards')
      .insert(
        withCompany({
          num_carte: legacy.numCarte.trim(),
          solde: Number(legacy.solde) || 0,
          conducteur_id: conducteurId,
          status: 'active',
        }) as never
      )
      .select('id')
      .single();

    if (error || !data) {
      console.warn('[fuelCardRepository] legacy import skipped card:', legacy.numCarte, error?.message);
      continue;
    }

    imported += 1;
    const cardId = (data as { id: string }).id;
    const entries = [...(historyByLegacyCardId.get(legacy.id) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

    if (entries.length === 0) {
      await insertFuelCardHistory(
        cardId,
        'creation',
        Number(legacy.solde) || 0,
        Number(legacy.solde) || 0
      );
      continue;
    }

    for (const entry of entries) {
      const historyResult = await insertFuelCardHistory(
        cardId,
        entry.type as LegacyFuelCardHistoryType,
        Number(entry.amount) || 0,
        Number(entry.balanceAfter) || 0,
        entry.createdAt
      );
      if (!historyResult.ok) {
        console.warn('[fuelCardRepository] legacy history import failed:', historyResult.error);
      }
    }
  }

  if (imported > 0) {
    markLegacyImportCompleted(companyId);
  }

  return { imported };
}

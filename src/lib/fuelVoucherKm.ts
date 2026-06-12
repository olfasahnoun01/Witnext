import { supabase } from '@/integrations/supabase/client';
import { isFuelVoucherApproved, normalizeFuelVoucherStatus } from '@/lib/fuelVoucherStatus';

export interface FuelVoucherKmRow {
  id: string;
  km: number | null;
  km_initial: number | null;
  status: string | null;
  vehicule_id: string | null;
  created_at?: string;
}

/** Km final is only meaningful once the driver has approved the voucher. */
export function resolveVoucherKmFinal(row: {
  km: number | null;
  km_initial?: number | null;
  status: string | null;
}): number | null {
  if (!isFuelVoucherApproved(row.status)) return null;
  if (row.km == null) return null;
  const km = Number(row.km);
  if (!Number.isFinite(km)) return null;
  return km;
}

export function computeFuelVoucherDistance(
  kmFinal: number | null | undefined,
  kmInitial: number | null | undefined
): number | null {
  if (kmFinal == null || kmInitial == null) return null;
  const delta = Number(kmFinal) - Number(kmInitial);
  return Number.isFinite(delta) ? delta : null;
}

function isValidApprovedKmFinal(km: number, kmInitial: number | null | undefined): boolean {
  if (kmInitial == null) return true;
  const ki = Number(kmInitial);
  return Number.isFinite(ki) && km >= ki;
}

/** Last approved voucher km final for one vehicle — never mixed across cars. */
export async function fetchLastApprovedKmFinal(vehicleId: string): Promise<number | null> {
  if (!vehicleId.trim()) return null;

  const { data, error } = await supabase
    .from('fuel_vouchers')
    .select('id, km, km_initial, status, created_at')
    .eq('vehicule_id', vehicleId)
    .not('km', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.warn('[fuelVoucherKm] fetchLastApprovedKmFinal:', error.message);
    return null;
  }

  for (const row of data ?? []) {
    if (!isFuelVoucherApproved(row.status)) continue;
    const km = Number(row.km);
    if (!Number.isFinite(km)) continue;
    if (!isValidApprovedKmFinal(km, row.km_initial)) continue;
    return km;
  }

  return null;
}

/** Sort vouchers chronologically per vehicle (oldest first). */
export function sortVouchersByVehicleChain<T extends { vehicule_id: string | null; created_at?: string; date?: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const va = a.vehicule_id ?? '';
    const vb = b.vehicule_id ?? '';
    if (va !== vb) return va.localeCompare(vb);
    const ta = a.created_at ?? a.date ?? '';
    const tb = b.created_at ?? b.date ?? '';
    return ta.localeCompare(tb);
  });
}

type VoucherChainRow = {
  id: string;
  vehicule_id: string | null;
  created_at?: string;
  date?: string;
};

function chainSortKey(row: { created_at?: string; date?: string }): string {
  return row.created_at ?? row.date ?? '';
}

/** Vouchers of one vehicle only, oldest → newest (km chain order). */
export function getVehicleVoucherChain<T extends VoucherChainRow>(
  vehicleId: string | null,
  rows: T[]
): T[] {
  const vid = vehicleId ?? '__none__';
  return rows
    .filter((r) => (r.vehicule_id ?? '__none__') === vid)
    .sort((a, b) => chainSortKey(a).localeCompare(chainSortKey(b)));
}

/** Next voucher chronologically for the same vehicle only (never another car). */
export function getNextVoucherSameVehicle<T extends VoucherChainRow>(
  bon: T,
  rows: T[]
): T | null {
  if (!bon.vehicule_id) return null;
  const chain = getVehicleVoucherChain(bon.vehicule_id, rows);
  const idx = chain.findIndex((r) => r.id === bon.id);
  if (idx < 0 || idx >= chain.length - 1) return null;
  return chain[idx + 1];
}

export interface VehicleVoucherGroup<T extends VoucherChainRow> {
  vehicleId: string;
  vouchers: T[];
}

/** Group all vouchers by vehicle; each group is its own km chain (oldest first). */
export function groupVouchersByVehicle<T extends VoucherChainRow>(rows: T[]): VehicleVoucherGroup<T>[] {
  const byVehicle = new Map<string, T[]>();
  for (const row of rows) {
    const vid = row.vehicule_id ?? '__none__';
    const list = byVehicle.get(vid) ?? [];
    list.push(row);
    byVehicle.set(vid, list);
  }

  return [...byVehicle.entries()]
    .map(([vehicleId, vouchers]) => ({
      vehicleId,
      vouchers: getVehicleVoucherChain(vehicleId === '__none__' ? null : vehicleId, vouchers),
    }))
    .sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));
}

/**
 * Next pending voucher for the same vehicle (created after [afterCreatedAt]).
 * Used to propagate approved km final → next km initial.
 */
export async function fetchNextPendingVoucherForVehicle(
  vehicleId: string,
  afterCreatedAt: string
): Promise<{ id: string; km_initial: number | null } | null> {
  if (!vehicleId.trim()) return null;

  const { data, error } = await supabase
    .from('fuel_vouchers')
    .select('id, km_initial, status, created_at')
    .eq('vehicule_id', vehicleId)
    .gt('created_at', afterCreatedAt)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.warn('[fuelVoucherKm] fetchNextPendingVoucherForVehicle:', error.message);
    return null;
  }

  for (const row of data ?? []) {
    if (normalizeFuelVoucherStatus(row.status) !== 'pending') continue;
    return { id: row.id as string, km_initial: row.km_initial as number | null };
  }
  return null;
}

export async function syncNextPendingVoucherKmInitial(
  vehicleId: string,
  approvedKmFinal: number,
  approvedCreatedAt: string
): Promise<void> {
  const next = await fetchNextPendingVoucherForVehicle(vehicleId, approvedCreatedAt);
  if (!next) return;
  if (next.km_initial === approvedKmFinal) return;

  const { error } = await supabase
    .from('fuel_vouchers')
    .update({ km_initial: approvedKmFinal })
    .eq('id', next.id);

  if (error) {
    console.warn('[fuelVoucherKm] syncNextPendingVoucherKmInitial:', error.message);
  }
}

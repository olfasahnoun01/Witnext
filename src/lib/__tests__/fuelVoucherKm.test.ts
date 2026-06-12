import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

import {
  computeFuelVoucherDistance,
  getNextVoucherSameVehicle,
  getVehicleVoucherChain,
  resolveVoucherKmFinal,
  sortVouchersByVehicleChain,
} from '../fuelVoucherKm';

describe('resolveVoucherKmFinal', () => {
  it('returns null for pending vouchers even if km is set', () => {
    expect(
      resolveVoucherKmFinal({ km: 1500, km_initial: 1500, status: 'pending' })
    ).toBeNull();
  });

  it('returns km for approved vouchers', () => {
    expect(
      resolveVoucherKmFinal({ km: 1600, km_initial: 1500, status: 'approved' })
    ).toBe(1600);
  });

  it('returns km for approuvé status', () => {
    expect(
      resolveVoucherKmFinal({ km: 1600, km_initial: 1500, status: 'approuvé' })
    ).toBe(1600);
  });
});

describe('computeFuelVoucherDistance', () => {
  it('computes final minus initial', () => {
    expect(computeFuelVoucherDistance(1600, 1500)).toBe(100);
  });
});

describe('getNextVoucherSameVehicle', () => {
  const rows = [
    { id: 'a1', vehicule_id: 'car-a', created_at: '2026-06-01T00:00:00Z', km_initial: 1000 },
    { id: 'a2', vehicule_id: 'car-a', created_at: '2026-06-02T00:00:00Z', km_initial: 1500 },
    { id: 'b1', vehicule_id: 'car-b', created_at: '2026-06-01T00:00:00Z', km_initial: 5000 },
  ];

  it('returns next voucher for the same vehicle only', () => {
    expect(getNextVoucherSameVehicle(rows[0], rows)?.id).toBe('a2');
  });

  it('does not link to another vehicle', () => {
    expect(getNextVoucherSameVehicle(rows[0], rows)?.vehicule_id).toBe('car-a');
    expect(getNextVoucherSameVehicle(rows[1], rows)).toBeNull();
    expect(getNextVoucherSameVehicle(rows[2], rows)).toBeNull();
  });
});

describe('getVehicleVoucherChain', () => {
  it('isolates chains per vehicle', () => {
    const rows = [
      { id: 'a2', vehicule_id: 'car-a', created_at: '2026-06-02T00:00:00Z' },
      { id: 'b1', vehicule_id: 'car-b', created_at: '2026-06-01T00:00:00Z' },
      { id: 'a1', vehicule_id: 'car-a', created_at: '2026-06-01T00:00:00Z' },
    ];
    expect(getVehicleVoucherChain('car-a', rows).map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(getVehicleVoucherChain('car-b', rows).map((r) => r.id)).toEqual(['b1']);
  });
});

describe('sortVouchersByVehicleChain', () => {
  it('orders by vehicle then created_at ascending', () => {
    const sorted = sortVouchersByVehicleChain([
      { id: '2', vehicule_id: 'v1', created_at: '2026-06-02T00:00:00Z' },
      { id: '1', vehicule_id: 'v1', created_at: '2026-06-01T00:00:00Z' },
      { id: '3', vehicule_id: 'v2', created_at: '2026-06-01T00:00:00Z' },
    ] as { id: string; vehicule_id: string; created_at: string }[]);

    expect(sorted.map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});

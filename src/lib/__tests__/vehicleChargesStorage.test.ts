import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/lib/activeCompany', () => ({
  requireActiveCompanyId: () => 'company-a',
}));

import {
  loadVehicleCharges,
  saveVehicleCharges,
  type VehicleChargeRecord,
} from '@/lib/vehicleChargesStorage';

const sampleCharge: VehicleChargeRecord = {
  id: 'charge-1',
  vehicule: 'Peugeot (123-TU-456)',
  type: 'assurance',
  dateEcheance: '2026-12-31',
  montant: '1200',
  notes: '',
  provider: 'STAR',
  contractNumber: 'C-001',
};

function installLocalStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
}

function chain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.order = vi.fn(self);
  api.in = vi.fn(self);
  api.delete = vi.fn(self);
  api.upsert = vi.fn(() => Promise.resolve({ error: result.error ?? null }));
  api.then = undefined;
  // Make awaitable: resolve with result when awaited via Promise.resolve(chain)
  Object.assign(api, {
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      }));
    },
  });
  return api;
}

describe('vehicleChargesStorage', () => {
  beforeEach(() => {
    installLocalStorageMock();
    mockFrom.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty when no company id', async () => {
    expect(await loadVehicleCharges(null)).toEqual([]);
  });

  it('loads charges from supabase for the company', async () => {
    mockFrom.mockReturnValue(
      chain({
        count: 0,
        data: [
          {
            id: sampleCharge.id,
            company_id: 'company-a',
            vehicle_label: sampleCharge.vehicule,
            type: sampleCharge.type,
            date_echeance: sampleCharge.dateEcheance,
            montant: sampleCharge.montant,
            notes: sampleCharge.notes,
            provider: sampleCharge.provider,
            contract_number: sampleCharge.contractNumber,
            reminder_date: null,
            valeur_totale: null,
            montant_paye: null,
          },
        ],
      })
    );

    const rows = await loadVehicleCharges('company-a');
    expect(rows).toEqual([sampleCharge]);
    expect(mockFrom).toHaveBeenCalledWith('vehicle_charges');
  });

  it('migrates localStorage into empty DB then clears local key', async () => {
    localStorage.setItem('grosafe_charges_vehicules_company-a', JSON.stringify([sampleCharge]));

    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) return chain({ count: 0 }); // migrate count
      if (call === 2) return chain({}); // migrate upsert
      return chain({ data: [] }); // final load
    });

    await loadVehicleCharges('company-a');
    expect(localStorage.getItem('grosafe_charges_vehicules_company-a')).toBeNull();
  });

  it('saveVehicleCharges upserts and deletes removed ids', async () => {
    const deleteIn = vi.fn(() => Promise.resolve({ error: null }));
    const upsert = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation(() => {
      const api: Record<string, unknown> = {};
      const self = () => api;
      api.select = vi.fn(self);
      api.eq = vi.fn(() =>
        Promise.resolve({ data: [{ id: 'old-1' }], error: null })
      );
      api.delete = vi.fn(() => ({ in: deleteIn }));
      api.upsert = upsert;
      return api;
    });

    await saveVehicleCharges('company-a', [sampleCharge]);
    expect(deleteIn).toHaveBeenCalledWith('id', ['old-1']);
    expect(upsert).toHaveBeenCalled();
  });
});

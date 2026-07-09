import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('vehicleChargesStorage', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty array when no charges exist', () => {
    expect(loadVehicleCharges('company-1')).toEqual([]);
  });

  it('saves and loads charges scoped by company', () => {
    saveVehicleCharges('company-a', [sampleCharge]);
    expect(loadVehicleCharges('company-a')).toEqual([sampleCharge]);
    expect(loadVehicleCharges('company-b')).toEqual([]);
  });

  it('migrates legacy global key into the active company bucket once', () => {
    localStorage.setItem('grosafe_charges_vehicules', JSON.stringify([sampleCharge]));

    expect(loadVehicleCharges('company-legacy')).toEqual([sampleCharge]);
    expect(localStorage.getItem('grosafe_charges_vehicules')).toBeNull();
    expect(localStorage.getItem('grosafe_charges_vehicules_company-legacy')).toBeTruthy();
  });

  it('does not overwrite an existing company bucket during legacy migration', () => {
    const existing: VehicleChargeRecord = { ...sampleCharge, id: 'existing' };
    localStorage.setItem('grosafe_charges_vehicules_company-a', JSON.stringify([existing]));
    localStorage.setItem('grosafe_charges_vehicules', JSON.stringify([sampleCharge]));

    expect(loadVehicleCharges('company-a')).toEqual([existing]);
    expect(localStorage.getItem('grosafe_charges_vehicules')).toBeNull();
  });

  it('returns empty array for invalid JSON payload', () => {
    localStorage.setItem('grosafe_charges_vehicules_global', '{not-json');
    expect(loadVehicleCharges(null)).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasLegacyImportCompleted,
  markLegacyImportCompleted,
  readLegacyFuelCards,
  resolveLegacyConducteurId,
  shouldAttemptLegacyImport,
} from '@/lib/fuelCardLegacyImport';
import { mapFuelCardRow } from '@/lib/fuelCardRepository';

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

describe('fuelCardLegacyImport', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves conducteur name to employee id', () => {
    const id = resolveLegacyConducteurId('Ali Ben Salah', [
      { id: 'emp-1', prenom: 'Ali', nom: 'Ben Salah' },
    ]);
    expect(id).toBe('emp-1');
  });

  it('attempts import only when legacy data exists and db is empty', () => {
    localStorage.setItem(
      'grosafe_fuel_cards',
      JSON.stringify([{ id: '1', numCarte: '1234', conducteur: 'Ali', solde: 10 }])
    );
    expect(shouldAttemptLegacyImport('company-a', 0)).toBe(true);
    expect(shouldAttemptLegacyImport('company-a', 1)).toBe(false);
  });

  it('marks import completed and clears legacy keys', () => {
    localStorage.setItem('grosafe_fuel_cards', '[]');
    localStorage.setItem('grosafe_fuel_card_history', '[]');
    markLegacyImportCompleted('company-a');
    expect(hasLegacyImportCompleted('company-a')).toBe(true);
    expect(readLegacyFuelCards()).toEqual([]);
    expect(localStorage.getItem('grosafe_fuel_card_history')).toBeNull();
  });
});

describe('fuelCardRepository mapping', () => {
  it('maps fuel card rows with employee join', () => {
    const view = mapFuelCardRow({
      id: 'card-1',
      num_carte: '8600 1234',
      solde: 150,
      conducteur_id: 'emp-1',
      employees: { prenom: 'Sami', nom: 'Trabelsi' },
    });
    expect(view.numCarte).toBe('8600 1234');
    expect(view.conducteur).toBe('Sami Trabelsi');
    expect(view.solde).toBe(150);
  });
});

const CARDS_STORAGE_KEY = 'grosafe_fuel_cards';
const HISTORY_STORAGE_KEY = 'grosafe_fuel_card_history';
const IMPORTED_FLAG_PREFIX = 'erp.fuelCardsLegacyImported.';

export interface LegacyFuelCard {
  id: string;
  numCarte: string;
  conducteur: string;
  solde: number;
}

export type LegacyFuelCardHistoryType = 'creation' | 'recharge';

export interface LegacyFuelCardHistoryEntry {
  id: string;
  cardId: string;
  type: LegacyFuelCardHistoryType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface EmployeeNameLookup {
  id: string;
  prenom: string;
  nom: string;
}

export function legacyImportFlagKey(companyId: string): string {
  return `${IMPORTED_FLAG_PREFIX}${companyId}`;
}

export function readLegacyFuelCards(): LegacyFuelCard[] {
  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyFuelCard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readLegacyFuelCardHistory(): LegacyFuelCardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyFuelCardHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasLegacyImportCompleted(companyId: string): boolean {
  try {
    return localStorage.getItem(legacyImportFlagKey(companyId)) === '1';
  } catch {
    return false;
  }
}

export function markLegacyImportCompleted(companyId: string): void {
  try {
    localStorage.setItem(legacyImportFlagKey(companyId), '1');
    localStorage.removeItem(CARDS_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Match legacy conducteur display name to an employee id when possible. */
export function resolveLegacyConducteurId(
  conducteurName: string,
  employees: EmployeeNameLookup[]
): string | null {
  const normalized = conducteurName.trim().toLowerCase();
  if (!normalized) return null;
  const match = employees.find(
    (emp) => `${emp.prenom} ${emp.nom}`.trim().toLowerCase() === normalized
  );
  return match?.id ?? null;
}

export function shouldAttemptLegacyImport(
  companyId: string,
  existingCardCount: number
): boolean {
  if (hasLegacyImportCompleted(companyId)) return false;
  if (existingCardCount > 0) return false;
  return readLegacyFuelCards().length > 0;
}

export type VehicleChargeType = 'visite_technique' | 'assurance' | 'vignette' | 'leasing';

export interface VehicleChargeRecord {
  id: string;
  vehicule: string;
  type: VehicleChargeType;
  dateEcheance: string;
  montant: string;
  notes: string;
  provider?: string;
  contractNumber?: string;
  reminderDate?: string;
  valeurTotale?: string;
  montantPaye?: string;
}

const LEGACY_STORAGE_KEY = 'grosafe_charges_vehicules';

function storageKey(companyId: string | null | undefined): string {
  return `grosafe_charges_vehicules_${companyId ?? 'global'}`;
}

/** One-time migration from the global key to the active company bucket. */
function migrateLegacyIfNeeded(companyId: string | null | undefined): void {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    const key = storageKey(companyId);
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, legacy);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadVehicleCharges(companyId: string | null | undefined): VehicleChargeRecord[] {
  try {
    migrateLegacyIfNeeded(companyId);
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VehicleChargeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVehicleCharges(
  companyId: string | null | undefined,
  records: VehicleChargeRecord[]
): void {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(records));
  } catch {
    // ignore quota
  }
}

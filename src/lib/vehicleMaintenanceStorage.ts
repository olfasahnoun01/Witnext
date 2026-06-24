export type MaintenanceType = 'preventive' | 'urgent' | 'corrective';
export type MaintenanceStatus = 'en_cours' | 'termine' | 'annule';

export interface VehicleMaintenanceRecord {
  id: string;
  vehicule: string;
  vehiculeId?: string;
  description: string;
  type: MaintenanceType;
  dateDebut: string;
  coutEstime: string;
  notes: string;
  status: MaintenanceStatus;
}

const LEGACY_STORAGE_KEY = 'grosafe_maintenances';

function storageKey(companyId: string | null | undefined): string {
  return `grosafe_maintenances_${companyId ?? 'global'}`;
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

export function loadMaintenanceRecords(companyId: string | null | undefined): VehicleMaintenanceRecord[] {
  try {
    migrateLegacyIfNeeded(companyId);
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VehicleMaintenanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMaintenanceRecords(
  companyId: string | null | undefined,
  records: VehicleMaintenanceRecord[]
): void {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(records));
  } catch {
    // ignore quota
  }
}

export function activeMaintenanceForVehicle(
  records: VehicleMaintenanceRecord[],
  vehicleId: string
): VehicleMaintenanceRecord | undefined {
  return records.find((r) => r.vehiculeId === vehicleId && r.status === 'en_cours');
}

export function hasActiveMaintenance(
  records: VehicleMaintenanceRecord[],
  vehicleId: string
): boolean {
  return records.some((r) => r.vehiculeId === vehicleId && r.status === 'en_cours');
}

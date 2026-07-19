import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

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

function maintenanceTable() {
  // Table created by migration; not yet in generated Supabase types.
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(
    'maintenance'
  );
}

type DbRow = {
  id: string;
  company_id: string;
  vehicle_id: string | null;
  vehicle_label: string;
  description: string;
  type: string;
  date_debut: string;
  cout_estime: string;
  notes: string;
  status: string;
};

function rowToRecord(row: DbRow): VehicleMaintenanceRecord {
  return {
    id: row.id,
    vehicule: row.vehicle_label || '',
    vehiculeId: row.vehicle_id || undefined,
    description: row.description,
    type: row.type as MaintenanceType,
    dateDebut: String(row.date_debut).slice(0, 10),
    coutEstime: row.cout_estime || '',
    notes: row.notes || '',
    status: row.status as MaintenanceStatus,
  };
}

function recordToRow(companyId: string, record: VehicleMaintenanceRecord) {
  return {
    id: record.id,
    company_id: companyId,
    vehicle_id: record.vehiculeId || null,
    vehicle_label: record.vehicule,
    description: record.description,
    type: record.type,
    date_debut: record.dateDebut,
    cout_estime: record.coutEstime || '',
    notes: record.notes || '',
    status: record.status,
  };
}

function readLocalRecords(companyId: string | null | undefined): VehicleMaintenanceRecord[] {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const key = storageKey(companyId);
    if (legacy && !localStorage.getItem(key)) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VehicleMaintenanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearLocalRecords(companyId: string | null | undefined): void {
  try {
    localStorage.removeItem(storageKey(companyId));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** One-time: push localStorage rows into DB when the company has no DB rows yet. */
async function migrateLocalToDb(companyId: string): Promise<void> {
  const local = readLocalRecords(companyId);
  if (local.length === 0) {
    clearLocalRecords(companyId);
    return;
  }

  const { count, error: countError } = await maintenanceTable()
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (countError) {
    console.warn('[maintenance] migrate count failed:', countError.message);
    return;
  }
  if ((count ?? 0) > 0) {
    clearLocalRecords(companyId);
    return;
  }

  const { error } = await maintenanceTable().upsert(
    local.map((r) => recordToRow(companyId, r)),
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[maintenance] migrate upsert failed:', error.message);
    return;
  }
  clearLocalRecords(companyId);
}

export async function loadMaintenanceRecords(
  companyId: string | null | undefined
): Promise<VehicleMaintenanceRecord[]> {
  if (!companyId) return [];
  await migrateLocalToDb(companyId);

  const { data, error } = await maintenanceTable()
    .select(
      'id, company_id, vehicle_id, vehicle_label, description, type, date_debut, cout_estime, notes, status'
    )
    .eq('company_id', companyId)
    .order('date_debut', { ascending: false });

  if (error) {
    console.error('[maintenance] load failed:', error.message);
    return readLocalRecords(companyId);
  }
  return ((data as DbRow[] | null) ?? []).map(rowToRecord);
}

export async function saveMaintenanceRecords(
  companyId: string | null | undefined,
  records: VehicleMaintenanceRecord[]
): Promise<void> {
  const cid = companyId ?? requireActiveCompanyId();

  const { data: existing, error: existingError } = await maintenanceTable()
    .select('id')
    .eq('company_id', cid);
  if (existingError) throw existingError;

  const nextIds = new Set(records.map((r) => r.id));
  const toDelete = ((existing as { id: string }[] | null) ?? [])
    .map((r) => r.id)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await maintenanceTable().delete().in('id', toDelete);
    if (delError) throw delError;
  }

  if (records.length > 0) {
    const { error: upsertError } = await maintenanceTable().upsert(
      records.map((r) => recordToRow(cid, r)),
      { onConflict: 'id' }
    );
    if (upsertError) throw upsertError;
  }

  clearLocalRecords(cid);
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

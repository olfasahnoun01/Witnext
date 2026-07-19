import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

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

function chargesTable() {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(
    'vehicle_charges'
  );
}

type DbRow = {
  id: string;
  company_id: string;
  vehicle_label: string;
  type: string;
  date_echeance: string;
  montant: string;
  notes: string;
  provider: string | null;
  contract_number: string | null;
  reminder_date: string | null;
  valeur_totale: string | null;
  montant_paye: string | null;
};

function rowToRecord(row: DbRow): VehicleChargeRecord {
  return {
    id: row.id,
    vehicule: row.vehicle_label || '',
    type: row.type as VehicleChargeType,
    dateEcheance: String(row.date_echeance).slice(0, 10),
    montant: row.montant || '',
    notes: row.notes || '',
    provider: row.provider || undefined,
    contractNumber: row.contract_number || undefined,
    reminderDate: row.reminder_date ? String(row.reminder_date).slice(0, 10) : undefined,
    valeurTotale: row.valeur_totale || undefined,
    montantPaye: row.montant_paye || undefined,
  };
}

function recordToRow(companyId: string, record: VehicleChargeRecord) {
  return {
    id: record.id,
    company_id: companyId,
    vehicle_label: record.vehicule,
    type: record.type,
    date_echeance: record.dateEcheance,
    montant: record.montant || '',
    notes: record.notes || '',
    provider: record.provider || null,
    contract_number: record.contractNumber || null,
    reminder_date: record.reminderDate || null,
    valeur_totale: record.valeurTotale || null,
    montant_paye: record.montantPaye || null,
  };
}

function readLocalRecords(companyId: string | null | undefined): VehicleChargeRecord[] {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const key = storageKey(companyId);
    if (legacy && !localStorage.getItem(key)) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VehicleChargeRecord[];
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

async function migrateLocalToDb(companyId: string): Promise<void> {
  const local = readLocalRecords(companyId);
  if (local.length === 0) {
    clearLocalRecords(companyId);
    return;
  }

  const { count, error: countError } = await chargesTable()
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (countError) {
    console.warn('[vehicle_charges] migrate count failed:', countError.message);
    return;
  }
  if ((count ?? 0) > 0) {
    clearLocalRecords(companyId);
    return;
  }

  const { error } = await chargesTable().upsert(
    local.map((r) => recordToRow(companyId, r)),
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[vehicle_charges] migrate upsert failed:', error.message);
    return;
  }
  clearLocalRecords(companyId);
}

export async function loadVehicleCharges(
  companyId: string | null | undefined
): Promise<VehicleChargeRecord[]> {
  if (!companyId) return [];
  await migrateLocalToDb(companyId);

  const { data, error } = await chargesTable()
    .select(
      'id, company_id, vehicle_label, type, date_echeance, montant, notes, provider, contract_number, reminder_date, valeur_totale, montant_paye'
    )
    .eq('company_id', companyId)
    .order('date_echeance', { ascending: true });

  if (error) {
    console.error('[vehicle_charges] load failed:', error.message);
    return readLocalRecords(companyId);
  }
  return ((data as DbRow[] | null) ?? []).map(rowToRecord);
}

export async function saveVehicleCharges(
  companyId: string | null | undefined,
  records: VehicleChargeRecord[]
): Promise<void> {
  const cid = companyId ?? requireActiveCompanyId();

  const { data: existing, error: existingError } = await chargesTable()
    .select('id')
    .eq('company_id', cid);
  if (existingError) throw existingError;

  const nextIds = new Set(records.map((r) => r.id));
  const toDelete = ((existing as { id: string }[] | null) ?? [])
    .map((r) => r.id)
    .filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await chargesTable().delete().in('id', toDelete);
    if (delError) throw delError;
  }

  if (records.length > 0) {
    const { error: upsertError } = await chargesTable().upsert(
      records.map((r) => recordToRow(cid, r)),
      { onConflict: 'id' }
    );
    if (upsertError) throw upsertError;
  }

  clearLocalRecords(cid);
}

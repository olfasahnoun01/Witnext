import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';

/** Calendar date YYYY-MM-DD in local timezone (avoids UTC off-by-one for Tunisia). */
export function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeDateIso(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().slice(0, 10);
}

export function isReminderDue(remindAt: string | null | undefined): boolean {
  const date = normalizeDateIso(remindAt);
  if (!date) return false;
  return date <= localDateIso();
}

function subtractDaysFromIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - days);
  return localDateIso(d);
}

export type VehicleReminderType =
  | 'vignette'
  | 'assurance'
  | 'leasing'
  | 'visite_technique'
  | 'vidange';

export type VehicleReminderRow = {
  vehicle_id: string;
  company_id: string;
  reminder_type: VehicleReminderType;
  due_date: string;
  remind_at: string;
  is_done: boolean;
  note: string | null;
};

export type VehicleReminderSource = {
  id: string;
  company_id?: string | null;
  kilometrage_actuel?: number | null;
  vidange_interval_km?: number | null;
  vidange_last_km?: number | null;
  vignette_due_date?: string | null;
  vignette_remind_at?: string | null;
  assurance_due_date?: string | null;
  assurance_remind_at?: string | null;
  leasing_due_date?: string | null;
  leasing_remind_at?: string | null;
  visite_technique_end_date?: string | null;
  visite_technique_remind_at?: string | null;
};

function resolveReminderCompanyId(vehicle: VehicleReminderSource): string | null {
  return vehicle.company_id ?? getActiveCompanyId();
}

/** Prochain kilométrage vidange (dernier vidange + intervalle). */
export function computeNextVidangeKm(vehicle: VehicleReminderSource): number | null {
  const interval = vehicle.vidange_interval_km;
  if (!interval || interval <= 0) return null;
  const last = vehicle.vidange_last_km ?? vehicle.kilometrage_actuel ?? 0;
  return last + interval;
}

export function isVidangeKmDue(vehicle: VehicleReminderSource): boolean {
  const nextKm = computeNextVidangeKm(vehicle);
  if (nextKm == null) return false;
  const current = vehicle.kilometrage_actuel ?? 0;
  return current >= nextKm;
}

export function buildVidangeReminderNote(nextKm: number, currentKm: number): string {
  return `Vidange prévue à ${Math.round(nextKm).toLocaleString('fr-FR')} km (actuel: ${Math.round(currentKm).toLocaleString('fr-FR')} km)`;
}

/** Build upsert rows from vehicle échéance / rappel fields (dates). */
export function buildVehicleReminderRows(vehicle: VehicleReminderSource): VehicleReminderRow[] {
  const companyId = resolveReminderCompanyId(vehicle);
  if (!companyId) return [];

  const defs: {
    type: Exclude<VehicleReminderType, 'vidange'>;
    due?: string | null;
    remindAt?: string | null;
  }[] = [
    { type: 'vignette', due: vehicle.vignette_due_date, remindAt: vehicle.vignette_remind_at },
    { type: 'assurance', due: vehicle.assurance_due_date, remindAt: vehicle.assurance_remind_at },
    { type: 'leasing', due: vehicle.leasing_due_date, remindAt: vehicle.leasing_remind_at },
    {
      type: 'visite_technique',
      due: vehicle.visite_technique_end_date,
      remindAt: vehicle.visite_technique_remind_at,
    },
  ];

  return defs
    .filter((d) => normalizeDateIso(d.due) || normalizeDateIso(d.remindAt))
    .map((d) => {
      const due = normalizeDateIso(d.due) || normalizeDateIso(d.remindAt)!;
      const remindAt =
        normalizeDateIso(d.remindAt) || subtractDaysFromIso(due, 7);
      return {
        vehicle_id: vehicle.id,
        company_id: companyId,
        reminder_type: d.type,
        due_date: due,
        remind_at: remindAt,
        is_done: false,
        note: null,
      };
    });
}

async function clearPendingVidangeReminders(vehicleId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('vehicle_reminders')
    .delete()
    .eq('vehicle_id', vehicleId)
    .eq('reminder_type', 'vidange')
    .eq('is_done', false);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Crée ou supprime le rappel vidange selon le kilométrage actuel. */
export async function syncVidangeReminderForVehicle(
  vehicle: VehicleReminderSource
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  const cleared = await clearPendingVidangeReminders(vehicle.id);
  if (!cleared.ok) {
    return { ok: false, created: false, error: cleared.error };
  }

  if (!vehicle.vidange_interval_km || vehicle.vidange_interval_km <= 0) {
    return { ok: true, created: false };
  }

  if (!isVidangeKmDue(vehicle)) {
    return { ok: true, created: false };
  }

  const companyId = resolveReminderCompanyId(vehicle);
  if (!companyId) {
    return { ok: false, created: false, error: 'Sélectionnez une société active avant de créer les rappels.' };
  }

  const nextKm = computeNextVidangeKm(vehicle)!;
  const currentKm = vehicle.kilometrage_actuel ?? 0;
  const today = localDateIso();

  const { error } = await supabase.from('vehicle_reminders').insert({
    vehicle_id: vehicle.id,
    company_id: companyId,
    reminder_type: 'vidange',
    due_date: today,
    remind_at: today,
    is_done: false,
    note: buildVidangeReminderNote(nextKm, currentKm),
  });

  if (error) {
    return { ok: false, created: false, error: error.message };
  }
  return { ok: true, created: true };
}

export async function upsertVehicleRemindersForVehicle(
  vehicle: VehicleReminderSource
): Promise<{ ok: boolean; count: number; error?: string }> {
  const companyId = resolveReminderCompanyId(vehicle);
  if (!companyId) {
    return { ok: false, count: 0, error: 'Sélectionnez une société active avant de créer les rappels.' };
  }

  const vehicleWithCompany = { ...vehicle, company_id: companyId };
  const rows = buildVehicleReminderRows(vehicleWithCompany);
  if (rows.length > 0) {
    const { error } = await supabase.from('vehicle_reminders').upsert(rows as never, {
      onConflict: 'vehicle_id,reminder_type,due_date',
    });
    if (error) {
      return { ok: false, count: 0, error: error.message };
    }
  }

  const vidangeResult = await syncVidangeReminderForVehicle(vehicleWithCompany);
  if (!vidangeResult.ok) {
    return { ok: false, count: rows.length, error: vidangeResult.error };
  }

  return { ok: true, count: rows.length + (vidangeResult.created ? 1 : 0) };
}

/** Resets vidange baseline to current km after service and clears pending vidange reminder. */
export async function markVidangeServiceDone(
  vehicleId: string,
  currentKm: number
): Promise<{ ok: boolean; error?: string }> {
  const { error: vehicleError } = await supabase
    .from('vehicles')
    .update({ vidange_last_km: currentKm })
    .eq('id', vehicleId);

  if (vehicleError) {
    return { ok: false, error: vehicleError.message };
  }

  await supabase
    .from('vehicle_reminders')
    .update({ is_done: true })
    .eq('vehicle_id', vehicleId)
    .eq('reminder_type', 'vidange')
    .eq('is_done', false);

  return { ok: true };
}

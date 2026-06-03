import { supabase } from '@/integrations/supabase/client';

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

export type VehicleReminderType = 'vignette' | 'assurance' | 'leasing' | 'visite_technique';

export type VehicleReminderRow = {
  vehicle_id: string;
  reminder_type: VehicleReminderType;
  due_date: string;
  remind_at: string;
  is_done: boolean;
  note: null;
};

export type VehicleReminderSource = {
  id: string;
  vignette_due_date?: string | null;
  vignette_remind_at?: string | null;
  assurance_due_date?: string | null;
  assurance_remind_at?: string | null;
  leasing_due_date?: string | null;
  leasing_remind_at?: string | null;
  visite_technique_end_date?: string | null;
  visite_technique_remind_at?: string | null;
};

/** Build upsert rows from vehicle échéance / rappel fields. */
export function buildVehicleReminderRows(vehicle: VehicleReminderSource): VehicleReminderRow[] {
  const defs: {
    type: VehicleReminderType;
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
        reminder_type: d.type,
        due_date: due,
        remind_at: remindAt,
        is_done: false,
        note: null,
      };
    });
}

export async function upsertVehicleRemindersForVehicle(
  vehicle: VehicleReminderSource
): Promise<{ ok: boolean; count: number; error?: string }> {
  const rows = buildVehicleReminderRows(vehicle);
  if (rows.length === 0) {
    return { ok: true, count: 0 };
  }

  const { error } = await supabase.from('vehicle_reminders').upsert(rows as never, {
    onConflict: 'vehicle_id,reminder_type,due_date',
  });

  if (error) {
    return { ok: false, count: 0, error: error.message };
  }
  return { ok: true, count: rows.length };
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS_AR: Record<DayKey, string> = {
  mon: 'الإثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
  sat: 'السبت',
  sun: 'الأحد',
};

export interface DayAssignment {
  morning: string;
  evening: string;
}

export interface DriverControlRow {
  id: string;
  name: string;
  days: Record<DayKey, DayAssignment>;
}

export interface DriverControlPlanningState {
  weekStart: string;
  site: string;
  shiftGroup: string;
  drivers: DriverControlRow[];
}

export function emptyDayAssignment(): DayAssignment {
  return { morning: '', evening: '' };
}

export function emptyDriverRow(): DriverControlRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    days: DAY_KEYS.reduce(
      (acc, key) => {
        acc[key] = emptyDayAssignment();
        return acc;
      },
      {} as Record<DayKey, DayAssignment>
    ),
  };
}

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMondayIso(ref: Date = new Date()): string {
  const day = ref.getDay();
  const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(ref.getFullYear(), ref.getMonth(), diff);
  return toIsoLocal(monday);
}

export function getSundayFromMondayIso(mondayIso: string): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  const sun = new Date(y, m - 1, d + 6);
  return toIsoLocal(sun);
}

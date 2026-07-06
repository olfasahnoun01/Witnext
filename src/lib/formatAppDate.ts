import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Parse ISO date strings, yyyy-mm-dd, or Date values for display. */
export function parseAppDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : parseISO(raw);
  return isValid(d) ? d : null;
}

/** Standard app date: dd/MM/yy */
export function formatAppDate(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parseAppDate(value);
  if (!d) return fallback;
  return format(d, 'dd/MM/yy', { locale: fr });
}

/** Standard app date-time: dd/MM/yy HH:mm */
export function formatAppDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parseAppDate(value);
  if (!d) return fallback;
  return format(d, 'dd/MM/yy HH:mm', { locale: fr });
}

/** Month + year label for charts (mm/yy). */
export function formatAppMonthYear(value: string | Date | null | undefined, fallback = '—'): string {
  const d = parseAppDate(value);
  if (!d) return fallback;
  return format(d, 'MM/yy', { locale: fr });
}

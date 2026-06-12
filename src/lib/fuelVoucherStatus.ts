import { cn } from '@/lib/utils';

export type FuelVoucherStatusKey = 'pending' | 'approved' | 'rejected' | 'used' | 'unknown';

const PENDING_VALUES = new Set([
  'pending',
  'en_attente',
  'en-attente',
  'attente',
  'waiting',
]);

const APPROVED_VALUES = new Set([
  'approved',
  'approuve',
  'approuvé',
  'approuvee',
  'valide',
  'validé',
  'validee',
  'accepte',
  'accepté',
  'acceptee',
]);

const REJECTED_VALUES = new Set([
  'rejected',
  'refuse',
  'refusé',
  'refusee',
  'rejete',
  'rejeté',
  'rejetee',
  'denied',
]);

const USED_VALUES = new Set(['used', 'utilise', 'utilisé', 'utilisee', 'consomme', 'consommé']);

export function isFuelVoucherApproved(raw: string | null | undefined): boolean {
  return normalizeFuelVoucherStatus(raw) === 'approved' || normalizeFuelVoucherStatus(raw) === 'used';
}

export function normalizeFuelVoucherStatus(raw: string | null | undefined): FuelVoucherStatusKey {
  const s = (raw || 'pending')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

  if (PENDING_VALUES.has(s)) return 'pending';
  if (APPROVED_VALUES.has(s)) return 'approved';
  if (REJECTED_VALUES.has(s)) return 'rejected';
  if (USED_VALUES.has(s)) return 'used';
  return 'unknown';
}

const STATUS_META: Record<
  FuelVoucherStatusKey,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: 'En attente',
    badgeClass:
      'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
  },
  approved: {
    label: 'Approuvé',
    badgeClass:
      'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700',
  },
  rejected: {
    label: 'Refusé',
    badgeClass:
      'bg-red-100 text-red-900 border-red-300 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700',
  },
  used: {
    label: 'Utilisé',
    badgeClass:
      'bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
  },
  unknown: {
    label: 'Statut inconnu',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

export function getFuelVoucherStatusDisplay(status: string | null | undefined) {
  const key = normalizeFuelVoucherStatus(status);
  return { key, ...STATUS_META[key] };
}

export function fuelVoucherStatusBadgeClass(status: string | null | undefined) {
  return cn('font-medium border', getFuelVoucherStatusDisplay(status).badgeClass);
}

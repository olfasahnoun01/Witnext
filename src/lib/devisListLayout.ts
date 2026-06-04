import type { Devis } from '@/types';

/** Timestamp for sorting: prefer last update, then creation, then document date. */
export function devisListSortTimeMs(d: Pick<Devis, 'updated_at' | 'created_at' | 'devis_date'>): number {
  const t = (iso?: string | null) => {
    if (!iso) return 0;
    const n = new Date(iso).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  return Math.max(t(d.updated_at), t(d.created_at), t(d.devis_date));
}

export function isListDocumentDraft(status: Devis['status'] | string | null | undefined): boolean {
  const s = (status == null || status === '') ? 'brouillon' : String(status).toLowerCase().trim();
  return s === 'brouillon';
}

/** Devis considéré comme confirmé (accepté, confirmé, reçu, intégré). */
export function isDevisConfirmed(status: Devis['status'] | string | null | undefined): boolean {
  const s = (status == null || status === '') ? 'brouillon' : String(status).toLowerCase().trim();
  return s === 'accepté' || s === 'confirmé' || s === 'reçu' || s === 'intégré';
}

/** Sort newest first (Gmail-style). */
export function sortDevisListRecentFirst<T extends Pick<Devis, 'updated_at' | 'created_at' | 'devis_date'>>(items: T[]): T[] {
  return [...items].sort((a, b) => devisListSortTimeMs(b) - devisListSortTimeMs(a));
}

export function partitionDraftsAndRest<T extends { status?: Devis['status'] | string | null }>(
  itemsSortedRecentFirst: T[]
): { drafts: T[]; rest: T[] } {
  const drafts: T[] = [];
  const rest: T[] = [];
  for (const x of itemsSortedRecentFirst) {
    if (isListDocumentDraft(x.status)) drafts.push(x);
    else rest.push(x);
  }
  return { drafts, rest };
}

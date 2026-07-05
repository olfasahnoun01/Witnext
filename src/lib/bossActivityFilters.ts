import {
  emptyCommercialDocCounts,
  incrementDocCount,
  type CommercialDocCounts,
  type CommercialDocKind,
} from '@/lib/commercialDocKind';
import type { BossCommercialDocument, BossEmployeeActivity } from '@/services/bossCommercialService';

/** Boss dashboard document-type filter. */
export type BossDocTypeFilter = 'all' | 'DEVIS_CLIENT' | 'DEVIS_FOURNISSEUR' | 'BC';

export const BOSS_DOC_TYPE_FILTER_OPTIONS: { value: BossDocTypeFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'DEVIS_CLIENT', label: 'Devis client' },
  { value: 'DEVIS_FOURNISSEUR', label: 'Devis fournisseur' },
  { value: 'BC', label: 'BC' },
];

export function matchesBossDocTypeFilter(kind: CommercialDocKind, filter: BossDocTypeFilter): boolean {
  if (filter === 'all') return kind !== 'OTHER';
  if (filter === 'BC') return kind === 'BC_CLIENT' || kind === 'BC_FOURNISSEUR';
  return kind === filter;
}

export function filterBossDocuments(
  documents: BossCommercialDocument[],
  typeFilter: BossDocTypeFilter
): BossCommercialDocument[] {
  return documents.filter((d) => matchesBossDocTypeFilter(d.kind, typeFilter));
}

export function computeFilteredCounts(
  documents: BossCommercialDocument[],
  typeFilter: BossDocTypeFilter
): CommercialDocCounts {
  let counts = emptyCommercialDocCounts();
  for (const doc of documents) {
    if (!matchesBossDocTypeFilter(doc.kind, typeFilter)) continue;
    counts = incrementDocCount(counts, doc.kind);
  }
  return counts;
}

export function matchesBossNameFilter(member: { fullName: string; email: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = member.fullName.toLowerCase();
  const email = (member.email ?? '').toLowerCase();
  return name.includes(q) || email.includes(q);
}

export function filterBossEmployeeActivities(
  employees: BossEmployeeActivity[],
  opts: { nameQuery: string; typeFilter: BossDocTypeFilter }
): BossEmployeeActivity[] {
  return employees
    .filter((row) => matchesBossNameFilter(row.member, opts.nameQuery))
    .map((row) => {
      const documents = filterBossDocuments(row.documents, opts.typeFilter);
      const counts = computeFilteredCounts(row.documents, opts.typeFilter);
      return { ...row, documents, counts };
    })
    .filter((row) => opts.typeFilter === 'all' || row.documents.length > 0);
}

export function parseBossDocTypeFilter(value: string | null): BossDocTypeFilter {
  if (
    value === 'DEVIS_CLIENT' ||
    value === 'DEVIS_FOURNISSEUR' ||
    value === 'BC' ||
    value === 'all'
  ) {
    return value;
  }
  return 'all';
}

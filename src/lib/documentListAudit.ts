/** Helpers for "Dernière modification" / "Modifiée par" columns in document lists. */

import { formatAppDateTime } from '@/lib/formatAppDate';

export type DocumentAuditFields = {
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  creator_name?: string | null;
  modifier_name?: string | null;
};

export function buildProfilesMap(
  profiles: Array<{ user_id: string; full_name: string | null; email: string | null }>
): Record<string, string> {
  const map: Record<string, string> = {};
  profiles.forEach((p) => {
    map[p.user_id] = p.full_name?.trim() || p.email?.trim() || 'Inconnu';
  });
  return map;
}

export function collectUserIdsForProfiles(
  rows: Array<{ created_by?: string | null; updated_by?: string | null }>
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.created_by) ids.add(row.created_by);
    if (row.updated_by) ids.add(row.updated_by);
  }
  return [...ids];
}

export function attachProfileNames<T extends { created_by?: string | null; updated_by?: string | null }>(
  row: T,
  profilesMap: Record<string, string>
): T & { creator_name: string | null; modifier_name: string | null } {
  return {
    ...row,
    creator_name: row.created_by ? profilesMap[row.created_by] ?? null : null,
    modifier_name: row.updated_by ? profilesMap[row.updated_by] ?? null : null,
  };
}

/** Date/time; appends " — par …" when another user last modified the row. */
export function formatDerniereModification(doc: DocumentAuditFields): string {
  const dateStr = formatAppDateTime(doc.updated_at);
  if (
    doc.updated_by &&
    doc.created_by &&
    doc.updated_by !== doc.created_by &&
    doc.modifier_name
  ) {
    return `${dateStr} — par ${doc.modifier_name}`;
  }
  return dateStr;
}

/** Name of last editor when different from creator; otherwise "-". */
export function formatModifieePar(doc: DocumentAuditFields): string {
  if (!doc.updated_by || !doc.created_by || doc.updated_by === doc.created_by) {
    return '-';
  }
  return doc.modifier_name || '-';
}

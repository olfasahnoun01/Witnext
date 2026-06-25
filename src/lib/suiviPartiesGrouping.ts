export interface SuiviPartiesRow {
  id: number;
  devis_date: string | null;
  devis_number: string | null;
  societe: string;
  telephone: string | null;
  reponse: string | null;
  dernier_contact_date: string | null;
}

export interface SocieteSuiviGroup {
  key: string;
  societe: string;
  telephone: string | null;
  entries: SuiviPartiesRow[];
  latestContactDate: string | null;
  latestDevisDate: string | null;
}

function parseDateValue(value: string | null): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function latestDate(rows: SuiviPartiesRow[], field: 'dernier_contact_date' | 'devis_date'): string | null {
  let best: string | null = null;
  let bestTs = 0;
  for (const row of rows) {
    const value = row[field];
    const ts = parseDateValue(value);
    if (ts > bestTs) {
      bestTs = ts;
      best = value;
    }
  }
  return best;
}

export function sortSuiviEntries(entries: SuiviPartiesRow[]): SuiviPartiesRow[] {
  return [...entries].sort((a, b) => {
    const byContact = parseDateValue(b.dernier_contact_date) - parseDateValue(a.dernier_contact_date);
    if (byContact !== 0) return byContact;
    const byDevis = parseDateValue(b.devis_date) - parseDateValue(a.devis_date);
    if (byDevis !== 0) return byDevis;
    return b.id - a.id;
  });
}

/** Group flat suivi rows by société (client / fournisseur name). */
export function groupSuiviBySociete(rows: SuiviPartiesRow[]): SocieteSuiviGroup[] {
  const map = new Map<string, SuiviPartiesRow[]>();

  for (const row of rows) {
    const key = row.societe.trim().toLowerCase();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups: SocieteSuiviGroup[] = [];

  for (const [key, rawEntries] of map) {
    const entries = sortSuiviEntries(rawEntries);
    const displayEntry = entries.reduce(
      (best, entry) => (entry.id > best.id ? entry : best),
      entries[0]
    );
    const telephone =
      entries.find((e) => e.telephone?.trim())?.telephone ?? displayEntry.telephone;

    groups.push({
      key,
      societe: displayEntry.societe.trim(),
      telephone: telephone?.trim() || null,
      entries,
      latestContactDate: latestDate(entries, 'dernier_contact_date'),
      latestDevisDate: latestDate(entries, 'devis_date'),
    });
  }

  return groups.sort((a, b) => {
    const aScore = Math.max(parseDateValue(a.latestContactDate), parseDateValue(a.latestDevisDate));
    const bScore = Math.max(parseDateValue(b.latestContactDate), parseDateValue(b.latestDevisDate));
    if (bScore !== aScore) return bScore - aScore;
    return a.societe.localeCompare(b.societe, 'fr', { sensitivity: 'base' });
  });
}

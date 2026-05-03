/** Persist multiple phone numbers in a single text column (plain one number, or JSON array). */

export function parsePhoneListFromStorage(value: string | null | undefined): string[] {
  const t = (value ?? '').trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) {
        return j.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      /* treat as literal */
    }
  }
  return [t];
}

export function serializePhoneList(lines: string[]): string {
  const cleaned = lines.map((v) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

export function formatPhonesDisplay(value: string | null | undefined): string {
  return parsePhoneListFromStorage(value).join(' · ');
}

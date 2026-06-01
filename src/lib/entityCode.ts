/**
 * Sequential entity code generation (clients, fournisseurs, …).
 * Infers the dominant prefix + numeric suffix from existing codes and returns
 * the next value with the same padding (e.g. CLI-001 → CLI-002).
 */

export interface ParsedEntityCode {
  prefix: string;
  num: number;
  width: number;
}

/** Split a code into a literal prefix and trailing digits (e.g. "CLI-001"). */
export function parseEntityCode(code: string): ParsedEntityCode | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[2], 10);
  if (!Number.isFinite(num)) return null;
  return { prefix: match[1], num, width: match[2].length };
}

function pickDominantPrefix(parsed: ParsedEntityCode[]): string {
  const counts = new Map<string, number>();
  for (const p of parsed) {
    counts.set(p.prefix, (counts.get(p.prefix) ?? 0) + 1);
  }
  let best = parsed[0].prefix;
  let bestCount = 0;
  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = prefix;
    }
  }
  return best;
}

/**
 * Returns the next code following the sequence already in use.
 * Falls back to `{fallbackPrefix}{1 padded}` when no parseable codes exist.
 */
export function generateNextEntityCode(
  existingCodes: string[],
  fallbackPrefix = 'CLI-',
  fallbackWidth = 3,
): string {
  const parsed = existingCodes
    .map((c) => parseEntityCode(c))
    .filter((p): p is ParsedEntityCode => p !== null);

  if (parsed.length === 0) {
    return `${fallbackPrefix}${String(1).padStart(fallbackWidth, '0')}`;
  }

  const dominantPrefix = pickDominantPrefix(parsed);
  const sameFamily = parsed.filter((p) => p.prefix === dominantPrefix);
  const maxNum = Math.max(...sameFamily.map((p) => p.num));
  const width = Math.max(...sameFamily.map((p) => p.width), fallbackWidth);

  return `${dominantPrefix}${String(maxNum + 1).padStart(width, '0')}`;
}

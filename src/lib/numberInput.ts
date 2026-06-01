/**
 * Locale-tolerant decimal parsing for controlled numeric inputs.
 *
 * Handles both French (comma decimal, dot/space thousands) and English
 * (dot decimal, comma thousands) styles, deciding by the position of the last
 * separator. Extracted from DevisForm so it can be shared and unit-tested.
 */

/** Parse a user-entered decimal string into a finite number (0 on failure). */
export function parseDecimalInput(rawValue: string): number {
  const value = rawValue.trim().replace(/\s/g, '');
  if (!value) return 0;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  let normalized = value;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // "1.234,56" -> dots are thousands, comma is decimal
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      // "1,234.56" -> commas are thousands
      normalized = value.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = value.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Like {@link parseDecimalInput} but tolerates a trailing decimal separator
 * mid-typing (e.g. "12." or "12,").
 */
export function parseDecimalInputLoose(rawValue: string): number {
  const value = rawValue.trim().replace(/\s/g, '');
  if (!value) return 0;
  if (/[.,]$/.test(value)) return parseDecimalInput(value.slice(0, -1));
  return parseDecimalInput(value);
}

/**
 * Render a number for a controlled input, keeping a real `0` visible
 * (unlike `value={n || ''}` which would blank it out).
 */
export function formatDecimalFieldValue(n: number): string {
  return Number.isFinite(n) ? String(n) : '';
}

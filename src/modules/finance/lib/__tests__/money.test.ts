import { describe, it, expect } from 'vitest';
import { round3, parseMontantInput, formatMontantDt } from '../money';

describe('round3', () => {
  it('rounds to millimes', () => {
    expect(round3(1.23449)).toBe(1.234);
    expect(round3(1.2345)).toBe(1.235);
    expect(round3(0.1 + 0.2)).toBe(0.3);
  });
});

describe('parseMontantInput', () => {
  it('accepts comma or dot decimals and trims/strips spaces', () => {
    expect(parseMontantInput('12,5')).toBe(12.5);
    expect(parseMontantInput('1 000,250')).toBe(1000.25);
    expect(parseMontantInput(' 3.14159 ')).toBe(3.142);
  });
  it('rejects empty, non-numeric and negative input', () => {
    expect(parseMontantInput('')).toBeNull();
    expect(parseMontantInput('abc')).toBeNull();
    expect(parseMontantInput('-5')).toBeNull();
  });
});

describe('formatMontantDt', () => {
  it('renders 3 decimals and the DT suffix', () => {
    const s = formatMontantDt(1250.35);
    expect(s).toMatch(/DT$/);
    // 3 fraction digits regardless of locale separators
    expect(s).toMatch(/350/);
  });
  it('falls back to 0 for non-finite input', () => {
    expect(formatMontantDt(Number.NaN)).toMatch(/DT$/);
  });
});

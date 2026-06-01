import { describe, it, expect } from 'vitest';
import { parseDecimalInput, parseDecimalInputLoose, formatDecimalFieldValue } from '../numberInput';

describe('parseDecimalInput', () => {
  it('parses plain and dot decimals', () => {
    expect(parseDecimalInput('12')).toBe(12);
    expect(parseDecimalInput('12.5')).toBe(12.5);
  });

  it('treats a lone comma as a decimal separator', () => {
    expect(parseDecimalInput('12,5')).toBe(12.5);
  });

  it('handles French style (dot thousands, comma decimal)', () => {
    expect(parseDecimalInput('1.234,56')).toBe(1234.56);
    expect(parseDecimalInput('1.000.000,5')).toBe(1000000.5);
  });

  it('handles English style (comma thousands, dot decimal)', () => {
    expect(parseDecimalInput('1,234.56')).toBe(1234.56);
  });

  it('strips spaces used as thousands separators', () => {
    expect(parseDecimalInput('1 000,250')).toBe(1000.25);
  });

  it('returns 0 for empty or non-numeric input', () => {
    expect(parseDecimalInput('')).toBe(0);
    expect(parseDecimalInput('   ')).toBe(0);
    expect(parseDecimalInput('abc')).toBe(0);
  });
});

describe('parseDecimalInputLoose', () => {
  it('tolerates a trailing separator while typing', () => {
    expect(parseDecimalInputLoose('12.')).toBe(12);
    expect(parseDecimalInputLoose('12,')).toBe(12);
  });
  it('matches parseDecimalInput for complete values', () => {
    expect(parseDecimalInputLoose('1.234,56')).toBe(1234.56);
  });
});

describe('formatDecimalFieldValue', () => {
  it('keeps a real zero visible', () => {
    expect(formatDecimalFieldValue(0)).toBe('0');
  });
  it('renders finite numbers and blanks non-finite', () => {
    expect(formatDecimalFieldValue(12.5)).toBe('12.5');
    expect(formatDecimalFieldValue(Number.NaN)).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { parseDecimalInput, parseDecimalInputLoose, formatDecimalFieldValue, filterDecimalDraft, formatDecimalInputDisplay } from '../numberInput';

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
  it('parses small decimals starting with zero', () => {
    expect(parseDecimalInputLoose('0.2156')).toBe(0.2156);
    expect(parseDecimalInputLoose('0,2156')).toBe(0.2156);
    expect(parseDecimalInputLoose('0.')).toBe(0);
  });
  it('matches parseDecimalInput for complete values', () => {
    expect(parseDecimalInputLoose('1.234,56')).toBe(1234.56);
  });
});

describe('filterDecimalDraft', () => {
  it('keeps digits and decimal separators only', () => {
    expect(filterDecimalDraft('0.2156')).toBe('0.2156');
    expect(filterDecimalDraft('0,2156')).toBe('0,2156');
    expect(filterDecimalDraft('abc12.5x')).toBe('12.5');
  });
});

describe('formatDecimalInputDisplay', () => {
  it('shows zero unless allowEmptyZero', () => {
    expect(formatDecimalInputDisplay(0)).toBe('0');
    expect(formatDecimalInputDisplay(0, true)).toBe('');
    expect(formatDecimalInputDisplay(0.2156)).toBe('0.2156');
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

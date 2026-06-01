import { describe, it, expect } from 'vitest';
import { parseEntityCode, generateNextEntityCode } from '../entityCode';

describe('parseEntityCode', () => {
  it('splits prefix and zero-padded suffix', () => {
    expect(parseEntityCode('CLI-001')).toEqual({ prefix: 'CLI-', num: 1, width: 3 });
    expect(parseEntityCode('FRN-012')).toEqual({ prefix: 'FRN-', num: 12, width: 3 });
  });

  it('handles codes without separator', () => {
    expect(parseEntityCode('CL0042')).toEqual({ prefix: 'CL', num: 42, width: 4 });
  });

  it('returns null for non-numeric suffixes', () => {
    expect(parseEntityCode('ABC')).toBeNull();
    expect(parseEntityCode('')).toBeNull();
  });
});

describe('generateNextEntityCode', () => {
  it('defaults to CLI-001 when no existing codes', () => {
    expect(generateNextEntityCode([])).toBe('CLI-001');
  });

  it('increments within the dominant prefix family', () => {
    expect(generateNextEntityCode(['CLI-001', 'CLI-002', 'CLI-010'])).toBe('CLI-011');
  });

  it('keeps padding width', () => {
    expect(generateNextEntityCode(['CLI-009'])).toBe('CLI-010');
  });

  it('follows the most common prefix when mixed', () => {
    expect(generateNextEntityCode(['CLI-001', 'CLI-002', 'X-999'])).toBe('CLI-003');
  });

  it('respects custom fallback prefix', () => {
    expect(generateNextEntityCode([], 'FRN-', 3)).toBe('FRN-001');
  });
});

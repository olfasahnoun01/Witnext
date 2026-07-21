import { describe, expect, it } from 'vitest';
import { nextDocumentNumberFromExisting } from '@/lib/documentNumbering';

describe('nextDocumentNumberFromExisting', () => {
  it('starts at 001 when empty', () => {
    expect(nextDocumentNumberFromExisting('BLF', 2026, [])).toBe('BLF-2026-001');
  });

  it('uses max seq + 1 instead of count (gaps after deletes)', () => {
    expect(
      nextDocumentNumberFromExisting('BLF', 2026, [
        'BLF-2026-001',
        'BLF-2026-003',
        'BLF-2026-002',
      ])
    ).toBe('BLF-2026-004');
  });

  it('ignores other prefixes and years', () => {
    expect(
      nextDocumentNumberFromExisting('BLF', 2026, [
        'BLC-2026-099',
        'BLF-2025-050',
        'BLF-2026-007',
      ])
    ).toBe('BLF-2026-008');
  });

  it('grows padding past 999', () => {
    expect(nextDocumentNumberFromExisting('BE', 2026, ['BE-2026-999'])).toBe('BE-2026-1000');
  });
});

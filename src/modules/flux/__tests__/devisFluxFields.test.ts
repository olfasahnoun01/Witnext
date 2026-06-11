import { describe, expect, it } from 'vitest';
import {
  isMissingDevisColumnError,
  queryDevisFluxRowsLite,
  resolveBcIdFromBlRow,
} from '../services/devisFluxFields';

describe('isMissingDevisColumnError', () => {
  it('detects Postgres missing column', () => {
    expect(isMissingDevisColumnError('column devis.source_bc_id does not exist')).toBe(true);
  });

  it('detects PostgREST schema cache errors', () => {
    expect(
      isMissingDevisColumnError(
        "Could not find the 'source_bc_id' column of 'devis' in the schema cache"
      )
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isMissingDevisColumnError('permission denied for table devis')).toBe(false);
  });
});

describe('queryDevisFluxRowsLite', () => {
  it('retries without optional columns when PostgREST reports missing column', async () => {
    const calls: string[] = [];
    const rows = await queryDevisFluxRowsLite(async (select) => {
      calls.push(select);
      if (select.includes('source_bc_id')) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'source_bc_id' column of 'devis' in the schema cache",
          },
        };
      }
      return { data: [{ id: 1, devis_number: 'D-1', status: 'brouillon' }], error: null };
    });

    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('source_bc_id');
    expect(calls[1]).not.toContain('source_bc_id');
    expect(rows).toHaveLength(1);
  });
});

describe('resolveBcIdFromBlRow', () => {
  it('prefers source_bc_id when present', () => {
    expect(resolveBcIdFromBlRow({ is_bl: true, source_bc_id: 10, source_devis_id: 5 })).toBe(10);
  });

  it('falls back to source_devis_id for legacy BL rows', () => {
    expect(resolveBcIdFromBlRow({ is_bl: true, source_devis_id: 5 })).toBe(5);
  });
});

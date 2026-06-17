import { describe, expect, it } from 'vitest';
import { buildCompanyStoragePath, expandStorageDownloadPaths } from '@/lib/storagePaths';

describe('storagePaths', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  it('buildCompanyStoragePath prefixes with company id', () => {
    expect(buildCompanyStoragePath('patente_acme.pdf', companyId)).toBe(
      `${companyId}/patente_acme.pdf`
    );
  });

  it('expandStorageDownloadPaths tries company prefix and legacy path', () => {
    const paths = expandStorageDownloadPaths('patente_acme.pdf', companyId);
    expect(paths).toContain('patente_acme.pdf');
    expect(paths).toContain(`${companyId}/patente_acme.pdf`);
  });
});

import { describe, expect, it, beforeEach } from 'vitest';
import {
  brandFromCompanyRow,
  hasCustomBranding,
  setCompanyBrandingCache,
  shouldUseDbBranding,
} from '../companyBranding';
import {
  getFactureCompanyBrand,
  setActiveCompanyCode,
} from '../factureCompanyBrand';

describe('companyBranding', () => {
  beforeEach(() => {
    setCompanyBrandingCache([]);
    setActiveCompanyCode(null);
  });

  it('detects custom branding when logo or legal fields are set', () => {
    expect(hasCustomBranding({ id: '1', code: 'acme', name: 'Acme' })).toBe(false);
    expect(
      hasCustomBranding({ id: '1', code: 'acme', name: 'Acme', logo_url: 'https://x/logo.png' })
    ).toBe(true);
  });

  it('uses DB branding for non-legacy companies even without logo', () => {
    const row = { id: '1', code: 'acme_corp', name: 'Acme Corp' };
    setCompanyBrandingCache([row]);
    expect(shouldUseDbBranding(row, 'acme_corp')).toBe(true);
    const brand = brandFromCompanyRow(row);
    expect(brand.displayName).toBe('ACME CORP');
    expect(brand.logoUrl).toBe('');
  });

  it('prefers DB branding for new tenant invoices', () => {
    setCompanyBrandingCache([
      {
        id: '1',
        code: 'acme_corp',
        name: 'Acme Corp',
        logo_url: 'https://cdn.example/logo.png',
        legal_name: 'ACME SARL',
        rib: '12 345',
      },
    ]);
    setActiveCompanyCode('acme_corp');
    const brand = getFactureCompanyBrand();
    expect(brand.displayName).toBe('ACME SARL');
    expect(brand.logoUrl).toBe('https://cdn.example/logo.png');
    expect(brand.rib).toBe('12 345');
  });

  it('keeps legacy hardcoded brands when no custom DB branding', () => {
    setCompanyBrandingCache([
      { id: '1', code: 'grosafe', name: 'Grosafe Equipements' },
    ]);
    const brand = getFactureCompanyBrand('grosafe');
    expect(brand.displayName).toBe('GROSAFE ÉQUIPEMENT');
  });
});

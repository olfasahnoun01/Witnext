import { describe, expect, it } from 'vitest';
import {
  getFactureCompanyBrand,
  resolveFactureCompanyCode,
  setActiveCompanyCode,
} from '../factureCompanyBrand';

describe('factureCompanyBrand', () => {
  it('defaults to granisafe (reference template)', () => {
    setActiveCompanyCode(null);
    expect(resolveFactureCompanyCode()).toBe('granisafe');
    expect(getFactureCompanyBrand().displayName).toBe('GRANI SAFE SOLUTION');
  });

  it('resolves grosafe and safe_team brands with distinct names, logos and colors', () => {
    const grosafe = getFactureCompanyBrand('grosafe');
    const safeTeam = getFactureCompanyBrand('safe_team');
    const granisafe = getFactureCompanyBrand('granisafe');

    expect(grosafe.displayName).toBe('GROSAFE ÉQUIPEMENT');
    expect(safeTeam.displayName).toBe('SAFE TEAM TRAINING');
    expect(granisafe.displayName).toBe('GRANI SAFE SOLUTION');
    expect(grosafe.logoUrl).toBeTruthy();
    expect(safeTeam.logoUrl).toBeTruthy();
    expect(granisafe.logoUrl).toBe('/gss-logo2.png');
    expect(grosafe.headerBarRgb).not.toEqual(granisafe.headerBarRgb);
    expect(safeTeam.headerBarRgb).not.toEqual(granisafe.headerBarRgb);
    expect(grosafe.primaryRgb).not.toEqual(safeTeam.primaryRgb);
  });

  it('uses active company code when no override is given', () => {
    setActiveCompanyCode('grosafe');
    expect(getFactureCompanyBrand().code).toBe('grosafe');
    setActiveCompanyCode('safe_team');
    expect(getFactureCompanyBrand().code).toBe('safe_team');
    setActiveCompanyCode(null);
  });
});

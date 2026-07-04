/**
 * Facture PDF branding per société.
 * Layout is identical for all companies; only name, colors, logo and legal lines differ.
 */

import grosafeLogo from '@/assets/grosafe-logo.webp';
import safeteamLogo from '@/assets/safeteam-logo.svg';

export type FactureCompanyCode = 'granisafe' | 'grosafe' | 'safe_team';

export interface FactureCompanyBrand {
  code: FactureCompanyCode;
  /** Full legal name shown in header bar and logo caption. */
  legalName: string;
  /** Short display name (header bar). */
  displayName: string;
  /** Primary brand color [R,G,B] — accents, title. */
  primaryRgb: [number, number, number];
  /** Text color on the name box [R,G,B]. */
  secondaryRgb: [number, number, number];
  /** Fill for company name box + table header. */
  headerBarRgb: [number, number, number];
  /** Light fill for secondary table headers (tax block). */
  tableHeadRgb: [number, number, number];
  codeTva: string;
  address: string;
  telFax: string;
  rib: string;
  /** Logo URL (public path or bundled asset). */
  logoUrl: string;
}

/** Granisafe = reference template (GRANI SAFE SOLUTION). */
const GRANISAFE_BRAND: FactureCompanyBrand = {
  code: 'granisafe',
  legalName: 'GRANI SAFE SOLUTION',
  displayName: 'GRANI SAFE SOLUTION',
  primaryRgb: [229, 168, 37],
  secondaryRgb: [30, 33, 36],
  headerBarRgb: [230, 230, 230],
  tableHeadRgb: [235, 235, 235],
  codeTva: '1924494G/A/M/000',
  address: 'IMMEUBLE SALMA ETAGE 6 D 64',
  telFax: '',
  rib: 'BNA 03 700 019 0115 008757 82',
  logoUrl: '/gss-logo2.png',
};

const GROSAFE_BRAND: FactureCompanyBrand = {
  code: 'grosafe',
  legalName: 'GROSAFE ÉQUIPEMENT',
  displayName: 'GROSAFE ÉQUIPEMENT',
  primaryRgb: [13, 44, 68],
  secondaryRgb: [13, 44, 68],
  headerBarRgb: [190, 214, 236], // blue name box
  tableHeadRgb: [220, 232, 244],
  codeTva: '',
  address: '',
  telFax: '',
  rib: '03 700 019 0115 008703 50',
  logoUrl: grosafeLogo,
};

const SAFE_TEAM_BRAND: FactureCompanyBrand = {
  code: 'safe_team',
  legalName: 'SAFE TEAM TRAINING',
  displayName: 'SAFE TEAM TRAINING',
  primaryRgb: [39, 153, 26],
  secondaryRgb: [40, 49, 56],
  headerBarRgb: [198, 232, 198], // green name box
  tableHeadRgb: [220, 240, 220],
  codeTva: '',
  address: '',
  telFax: '',
  rib: '',
  logoUrl: safeteamLogo,
};

const BRANDS: Record<FactureCompanyCode, FactureCompanyBrand> = {
  granisafe: GRANISAFE_BRAND,
  grosafe: GROSAFE_BRAND,
  safe_team: SAFE_TEAM_BRAND,
};

const CODE_STORAGE_KEY = 'erp.activeCompanyCode';

let activeCompanyCode: string | null = null;

try {
  if (typeof localStorage !== 'undefined') {
    activeCompanyCode = localStorage.getItem(CODE_STORAGE_KEY);
  }
} catch {
  /* ignore */
}

/** Persist active company code for non-React PDF generation. */
export function setActiveCompanyCode(code: string | null): void {
  activeCompanyCode = code;
  try {
    if (typeof localStorage !== 'undefined') {
      if (code) localStorage.setItem(CODE_STORAGE_KEY, code);
      else localStorage.removeItem(CODE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getActiveCompanyCode(): string | null {
  return activeCompanyCode;
}

export function resolveFactureCompanyCode(code?: string | null): FactureCompanyCode {
  const c = (code ?? activeCompanyCode ?? 'granisafe').toLowerCase();
  if (c === 'grosafe') return 'grosafe';
  if (c === 'safe_team' || c === 'safeteam' || c === 'safe-team') return 'safe_team';
  return 'granisafe';
}

/** Branding for the active (or explicit) company. Defaults to Granisafe template. */
export function getFactureCompanyBrand(code?: string | null): FactureCompanyBrand {
  return BRANDS[resolveFactureCompanyCode(code)];
}

/** All company brands (same layout, different logo/theme). */
export function listFactureCompanyBrands(): FactureCompanyBrand[] {
  return [BRANDS.granisafe, BRANDS.grosafe, BRANDS.safe_team];
}

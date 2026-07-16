/**
 * Per-company branding loaded from DB (logo, legal lines, theme).
 * Legacy hardcoded brands (grosafe / granisafe / safe_team) remain as fallback.
 */

import type { FactureCompanyBrand } from './factureCompanyBrand';

export const COMPANY_ASSETS_BUCKET = 'company-assets';

export interface CompanyBrandingRow {
  id: string;
  code: string;
  name: string;
  logo_url?: string | null;
  legal_name?: string | null;
  address?: string | null;
  tel_fax?: string | null;
  rib?: string | null;
  code_tva?: string | null;
  brand_primary_color?: string | null;
  brand_header_color?: string | null;
  brand_table_color?: string | null;
}

export interface CompanyBrandingInput {
  legal_name?: string;
  address?: string;
  tel_fax?: string;
  rib?: string;
  code_tva?: string;
  brand_primary_color?: string;
  brand_header_color?: string;
  brand_table_color?: string;
  logo_url?: string | null;
}

const brandingByCode = new Map<string, CompanyBrandingRow>();
const brandingById = new Map<string, CompanyBrandingRow>();

const LEGACY_CODES = new Set(['grosafe', 'granisafe', 'safe_team']);

const DEFAULT_PRIMARY: [number, number, number] = [30, 33, 36];
const DEFAULT_HEADER: [number, number, number] = [230, 230, 230];
const DEFAULT_TABLE: [number, number, number] = [235, 235, 235];

function hexToRgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const cleaned = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

/** Whether the row has any custom branding configured in the database. */
export function hasCustomBranding(row: CompanyBrandingRow | null | undefined): boolean {
  if (!row) return false;
  return !!(
    row.logo_url ||
    row.legal_name ||
    row.address ||
    row.tel_fax ||
    row.rib ||
    row.code_tva
  );
}

/** True when we should use DB branding instead of legacy hardcoded brands. */
export function shouldUseDbBranding(row: CompanyBrandingRow | null | undefined, code: string): boolean {
  if (!row) return false;
  if (hasCustomBranding(row)) return true;
  return !LEGACY_CODES.has(code.toLowerCase());
}

export function setCompanyBrandingCache(rows: CompanyBrandingRow[]): void {
  brandingByCode.clear();
  brandingById.clear();
  for (const row of rows) {
    brandingByCode.set(row.code.toLowerCase(), row);
    brandingById.set(row.id, row);
  }
}

export function getCachedBrandingByCode(code: string | null | undefined): CompanyBrandingRow | null {
  if (!code) return null;
  return brandingByCode.get(code.toLowerCase()) ?? null;
}

export function getCachedBrandingById(id: string | null | undefined): CompanyBrandingRow | null {
  if (!id) return null;
  return brandingById.get(id) ?? null;
}

/** Build a FactureCompanyBrand from a database company row. */
export function brandFromCompanyRow(row: CompanyBrandingRow): FactureCompanyBrand {
  const displayName = (row.legal_name?.trim() || row.name).toUpperCase();
  const primaryRgb = hexToRgb(row.brand_primary_color, DEFAULT_PRIMARY);
  return {
    code: row.code,
    legalName: displayName,
    displayName,
    primaryRgb,
    secondaryRgb: primaryRgb,
    headerBarRgb: hexToRgb(row.brand_header_color, DEFAULT_HEADER),
    tableHeadRgb: hexToRgb(row.brand_table_color, DEFAULT_TABLE),
    codeTva: row.code_tva?.trim() ?? '',
    address: row.address?.trim() ?? '',
    telFax: row.tel_fax?.trim() ?? '',
    rib: row.rib?.trim() ?? '',
    logoUrl: row.logo_url?.trim() ?? '',
  };
}

/** Logo URL for UI: DB first, then legacy map lookup handled by caller. */
export function getCompanyLogoUrl(row: CompanyBrandingRow | null | undefined): string | null {
  const url = row?.logo_url?.trim();
  return url || null;
}

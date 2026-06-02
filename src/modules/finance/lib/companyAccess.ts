import type { User } from '@supabase/supabase-js';
import { posteMatches } from '@/lib/userPositions';
import type { CompanyCode } from '../types';

/**
 * Codes d'accès par société. Lus depuis la configuration de build
 * (VITE_FINANCE_ACCESS_CODES = JSON "{\"grosafe\":\"1234\",...}") afin de ne
 * PAS committer de secret dans le code source. Le vrai contrôle d'accès reste
 * la RLS (table user_companies) : ce code n'est qu'une barrière UX optionnelle.
 * Si aucun code n'est configuré pour une société, aucune saisie n'est exigée.
 */
function loadFinanceAccessCodes(): Partial<Record<CompanyCode, string>> {
  const raw = import.meta.env.VITE_FINANCE_ACCESS_CODES as string | undefined;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed as Partial<Record<CompanyCode, string>>;
  } catch {
    console.warn('[financeAccess] VITE_FINANCE_ACCESS_CODES is not valid JSON; ignoring.');
    return {};
  }
}

export const FINANCE_COMPANY_ACCESS_CODES: Partial<Record<CompanyCode, string>> = loadFinanceAccessCodes();

/** True when a company has a configured access code (i.e. a PIN prompt is required). */
export function financeCompanyRequiresCode(companyCode: string): boolean {
  return Boolean(FINANCE_COMPANY_ACCESS_CODES[companyCode as CompanyCode]);
}

const VERIFIED_SESSION_KEY = 'finance_verified_company_ids';

export function getUserPosteFromMetadata(user: User | null): string {
  return String(user?.user_metadata?.position || user?.user_metadata?.role || '').trim();
}

/** Admin, modérateur, DG ou postes direction/finance peuvent changer de société. */
export function canSwitchFinanceCompany(
  isAdmin: boolean,
  isModerator: boolean,
  userPoste: string
): boolean {
  if (isAdmin || isModerator) return true;
  return posteMatches(userPoste, ['responsable financier', 'directeur generale', 'responsable administrative']);
}

export function verifyCompanyAccessCode(companyCode: string, enteredCode: string): boolean {
  const expected = FINANCE_COMPANY_ACCESS_CODES[companyCode as CompanyCode];
  // No code configured for this company => no PIN barrier (RLS still applies).
  if (!expected) return true;
  return enteredCode.trim() === expected;
}

export function readVerifiedCompanyIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(VERIFIED_SESSION_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markCompanyVerified(companyId: string): void {
  const verified = readVerifiedCompanyIds();
  verified.add(companyId);
  try {
    sessionStorage.setItem(VERIFIED_SESSION_KEY, JSON.stringify([...verified]));
  } catch {
    /* ignore */
  }
}

export function isCompanyVerifiedThisSession(companyId: string): boolean {
  return readVerifiedCompanyIds().has(companyId);
}

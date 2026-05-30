import type { User } from '@supabase/supabase-js';
import { posteMatches } from '@/lib/userPositions';
import type { CompanyCode } from '../types';

/** Codes d'accès par société (saisie obligatoire avant ouverture). */
export const FINANCE_COMPANY_ACCESS_CODES: Record<CompanyCode, string> = {
  grosafe: '123',
  granisafe: '456',
  safe_team: '789',
};

const VERIFIED_SESSION_KEY = 'finance_verified_company_ids';

export function getUserPosteFromMetadata(user: User | null): string {
  return String(user?.user_metadata?.position || user?.user_metadata?.role || '').trim();
}

/** Admin, modérateur ou responsable financier peuvent changer de société. */
export function canSwitchFinanceCompany(
  isAdmin: boolean,
  isModerator: boolean,
  userPoste: string
): boolean {
  if (isAdmin || isModerator) return true;
  return posteMatches(userPoste, ['responsable financier']);
}

export function verifyCompanyAccessCode(companyCode: string, enteredCode: string): boolean {
  const expected = FINANCE_COMPANY_ACCESS_CODES[companyCode as CompanyCode];
  if (!expected) return false;
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

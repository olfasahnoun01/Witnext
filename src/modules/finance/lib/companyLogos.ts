import type { CompanyCode } from '../types';
import grosafeLogo from '@/assets/grosafe-logo-new.png';
import safeteamLogo from '@/assets/safeteam-logo.svg';

const COMPANY_LOGOS: Record<CompanyCode, string> = {
  grosafe: grosafeLogo,
  granisafe: '/gss-logo2.png',
  safe_team: safeteamLogo,
};

export function getFinanceCompanyLogo(code: string): string | null {
  return COMPANY_LOGOS[code as CompanyCode] ?? null;
}

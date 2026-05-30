import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FinanceCapabilities, FinanceCompanyRow } from '../types';
import { getCapabilities } from '../companyProfile';

export interface FinanceCompanyContextValue {
  companies: FinanceCompanyRow[];
  company: FinanceCompanyRow | null;
  capabilities: FinanceCapabilities;
  canSwitchCompany: boolean;
  setCompanyId: (id: string) => void;
  requestCompanyPicker: () => void;
}

const FinanceCompanyContext = createContext<FinanceCompanyContextValue | null>(null);

export function FinanceCompanyProvider({
  companies,
  companyId,
  onCompanyIdChange,
  onRequestPicker,
  canSwitchCompany,
  children,
}: {
  companies: FinanceCompanyRow[];
  companyId: string | null;
  onCompanyIdChange: (id: string) => void;
  onRequestPicker: () => void;
  canSwitchCompany: boolean;
  children: ReactNode;
}) {
  const company = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  );

  const capabilities = useMemo(
    () => (company ? getCapabilities(company.code) : getCapabilities('grosafe')),
    [company]
  );

  const value = useMemo<FinanceCompanyContextValue>(
    () => ({
      companies,
      company,
      capabilities,
      canSwitchCompany,
      setCompanyId: onCompanyIdChange,
      requestCompanyPicker: onRequestPicker,
    }),
    [companies, company, capabilities, canSwitchCompany, onCompanyIdChange, onRequestPicker]
  );

  return (
    <FinanceCompanyContext.Provider value={value}>{children}</FinanceCompanyContext.Provider>
  );
}

export function useFinanceCompany(): FinanceCompanyContextValue {
  const ctx = useContext(FinanceCompanyContext);
  if (!ctx) {
    throw new Error('useFinanceCompany must be used within FinanceCompanyProvider');
  }
  return ctx;
}

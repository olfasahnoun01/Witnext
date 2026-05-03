import type { CompanyCode, FinanceCapabilities } from './types';

/** Comportement Finance attendu par societe (hors RLS). */
export const FINANCE_CAPABILITIES: Record<CompanyCode, FinanceCapabilities> = {
  grosafe: {
    purchases: true,
    supplierPayments: true,
    clientPayments: true,
    treasury: true,
    vatDeclarations: true,
    supplierWithholding: true,
    statements: true,
  },
  granisafe: {
    purchases: false,
    supplierPayments: false,
    clientPayments: true,
    treasury: true,
    vatDeclarations: true,
    supplierWithholding: false,
    statements: true,
  },
  safe_team: {
    purchases: false,
    supplierPayments: false,
    clientPayments: true,
    treasury: true,
    vatDeclarations: true,
    supplierWithholding: false,
    statements: true,
  },
};

export function getCapabilities(code: string): FinanceCapabilities {
  const c = code as CompanyCode;
  return FINANCE_CAPABILITIES[c] ?? FINANCE_CAPABILITIES.grosafe;
}

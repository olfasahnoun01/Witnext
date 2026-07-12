import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BookOpen,
  FileStack,
  LayoutDashboard,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';
import type { FinanceCapabilities } from '../types';

export type FinanceMainSectionId =
  | 'overview'
  | 'sources'
  | 'billing'
  | 'settlements'
  | 'treasury'
  | 'fiscal'
  | 'accounting';

export interface FinanceNavItem {
  id: string;
  label: string;
  description?: string;
}

export interface FinanceMainSection {
  id: FinanceMainSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const FINANCE_MAIN_SECTIONS: FinanceMainSection[] = [
  {
    id: 'overview',
    label: 'Résumé',
    icon: LayoutDashboard,
    description: 'Vue d\'ensemble',
  },
  {
    id: 'sources',
    label: 'Documents sources',
    icon: FileStack,
    description: 'Devis, BC, BL/BE/BS et annuaires tiers',
  },
  {
    id: 'billing',
    label: 'Facturation',
    icon: Receipt,
    description: 'Factures vente, achat et avoirs',
  },
  {
    id: 'settlements',
    label: 'Règlements & créances',
    icon: ArrowLeftRight,
    description: '',
  },
  {
    id: 'treasury',
    label: 'Trésorerie',
    icon: Wallet,
    description: 'Banque, caisse, effets et virements',
  },
  {
    id: 'fiscal',
    label: 'Fiscalité',
    icon: Scale,
    description: 'Tableau de bord fiscal, TVA et retenues à la source',
  },
  {
    id: 'accounting',
    label: 'Comptabilité',
    icon: BookOpen,
    description: 'Journal, grand livre et balance',
  },
];

export function getVisibleMainSections(caps: FinanceCapabilities): FinanceMainSection[] {
  return FINANCE_MAIN_SECTIONS.filter((s) => {
    if (s.id === 'fiscal') return caps.vatDeclarations;
    if (s.id === 'accounting') return caps.statements;
    return true;
  });
}

export function getBillingSubsections(caps: FinanceCapabilities): FinanceNavItem[] {
  const items: FinanceNavItem[] = [
    {
      id: 'sales',
      label: 'Factures vente',
      description: 'Comptes 411 · 700 · 4457 · timbre fiscal',
    },
  ];
  if (caps.purchases) {
    items.push({
      id: 'purchases',
      label: 'Factures achat',
      description: 'Comptes 401 · 607 · 4456 · FODEC',
    });
  }
  items.push({
    id: 'avoirs',
    label: 'Avoirs',
    description: 'Notes de crédit client et fournisseur',
  });
  return items;
}

export function getSettlementsSubsections(caps: FinanceCapabilities): FinanceNavItem[] {
  const items: FinanceNavItem[] = [
    {
      id: 'client-settlement',
      label: 'Encaissement client',
    },
  ];
  if (caps.supplierPayments) {
    items.push({
      id: 'supplier-settlement',
      label: 'Paiement fournisseur',
      description: 'Décaissement et retenue à la source',
    });
  }
  items.push(
    {
      id: 'history-clients',
      label: 'Historique clients',
      description: 'Encaissements enregistrés',
    },
    {
      id: 'aged-balance',
      label: 'Balance âgée',
      description: 'Créances et dettes par échéance',
    },
    {
      id: 'disputes',
      label: 'Litiges & impayés',
      description: 'Effets impayés et factures en litige',
    }
  );
  if (caps.supplierPayments) {
    items.splice(3, 0, {
      id: 'history-suppliers',
      label: 'Historique fournisseurs',
      description: 'Décaissements enregistrés',
    });
  }
  return items;
}

export function getTreasurySubsections(): FinanceNavItem[] {
  return [
    {
      id: 'bank',
      label: 'Banque',
      description: 'Comptes 512 — soldes et RIB',
    },
    {
      id: 'bank-fees',
      label: 'Frais bancaires',
      description: 'Commissions, intérêts et charges bancaires',
    },
    {
      id: 'unpaid',
      label: 'Impayée',
      description: 'Charges et effets impayés',
    },
    {
      id: 'bank-recon',
      label: 'Rapprochement',
      description: 'Rapprochement bancaire CSV',
    },
    {
      id: 'cash',
      label: 'Caisse',
      description: 'Comptes 531 — fonds en caisse',
    },
    {
      id: 'effects',
      label: 'Effets & traites',
      description: 'Portefeuille chèques et traites (514)',
    },
    {
      id: 'transfers',
      label: 'Virements',
      description: 'Mouvements inter-comptes',
    },
    {
      id: 'summary',
      label: 'Synthèse',
      description: 'Vue consolidée trésorerie',
    },
    {
      id: 'leasing-credit',
      label: 'État crédit leasing',
      description: 'Crédit-bail véhicules — échéancier mensuel',
    },
  ];
}

export function getFiscalSubsections(caps: FinanceCapabilities): FinanceNavItem[] {
  const items: FinanceNavItem[] = [
    {
      id: 'vat',
      label: 'Tableau de bord fiscal',
      description: 'TVA Collectée, TVA Déductible, timbres et retenues',
    },
  ];
  if (caps.supplierWithholding) {
    items.push({
      id: 'withholding',
      label: 'Attestations de retenue',
      description: 'Retenues fournisseurs, clients et export XML TEJ',
    });
  }
  items.push(
    {
      id: 'payroll-slips',
      label: 'Fiche de paie',
      description: 'Fiches mensuelles — CNSS, IRPP, net à payer',
    },
    {
      id: 'cnss-declaration',
      label: 'Déclaration CNSS',
      description: 'Déclaration trimestrielle et charges TFP / FOPROLOS',
    }
  );
  return items;
}

export function getAccountingSubsections(): FinanceNavItem[] {
  return [
    {
      id: 'statements',
      label: 'États comptables',
      description: 'Journal, grand livre, balance',
    },
  ];
}

export function getSourcesSubsections(): FinanceNavItem[] {
  return [
    {
      id: 'pieces',
      label: 'Pièces commerciales',
    },
  ];
}

export const DEFAULT_SUBSECTION: Record<FinanceMainSectionId, string> = {
  overview: 'dashboard',
  sources: 'pieces',
  billing: 'sales',
  settlements: 'client-settlement',
  treasury: 'bank',
  fiscal: 'vat',
  accounting: 'statements',
};

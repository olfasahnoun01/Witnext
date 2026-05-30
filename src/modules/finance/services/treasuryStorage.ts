/**
 * Persistance locale des comptes de trésorerie (sans SQL).
 * Clé par société — synchronisée avec les mouvements Supabase lorsque possible.
 */

import type {
  AvoirFinancier,
  AvoirParArticle,
  InterAccountTransfer,
  TreasuryAccount,
  WithholdingCertificate,
} from '../types/financeDomain';

const ACCOUNTS_KEY = (companyId: string) => `finance_treasury_accounts_v1_${companyId}`;
const TRANSFERS_KEY = (companyId: string) => `finance_transfers_v1_${companyId}`;
const AVOIRS_KEY = (companyId: string) => `finance_avoirs_v1_${companyId}`;
const AVOIRS_ARTICLE_KEY = (companyId: string) => `finance_avoirs_article_v1_${companyId}`;
const WITHHOLDING_KEY = (companyId: string) => `finance_withholding_v1_${companyId}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Comptes par défaut pour une nouvelle société Finance. */
export function defaultTreasuryAccounts(companyId: string): TreasuryAccount[] {
  const now = new Date().toISOString();
  return [
    {
      id: `acc-biat-${companyId.slice(0, 8)}`,
      companyId,
      nom: 'BIAT — Compte principal',
      type: 'BANQUE',
      codeComptable: '512100',
      rib: '080350000000000000000000',
      banqueLabel: 'BIAT',
      soldeActuel: 0,
      actif: true,
      createdAt: now,
    },
    {
      id: `acc-caisse-${companyId.slice(0, 8)}`,
      companyId,
      nom: 'Caisse centrale',
      type: 'CAISSE',
      codeComptable: '531000',
      rib: null,
      banqueLabel: null,
      soldeActuel: 0,
      actif: true,
      createdAt: now,
    },
    {
      id: `acc-attente-${companyId.slice(0, 8)}`,
      companyId,
      nom: 'Effets à encaisser (virtuel)',
      type: 'ATTENTE_EFFETS',
      codeComptable: '514000',
      rib: null,
      banqueLabel: null,
      soldeActuel: 0,
      actif: true,
      createdAt: now,
    },
  ];
}

export function loadTreasuryAccounts(companyId: string): TreasuryAccount[] {
  const stored = readJson<TreasuryAccount[]>(ACCOUNTS_KEY(companyId), []);
  if (stored.length === 0) {
    const defaults = defaultTreasuryAccounts(companyId);
    saveTreasuryAccounts(companyId, defaults);
    return defaults;
  }
  return stored;
}

export function saveTreasuryAccounts(companyId: string, accounts: TreasuryAccount[]): void {
  writeJson(ACCOUNTS_KEY(companyId), accounts);
}

export function loadTransfers(companyId: string): InterAccountTransfer[] {
  return readJson<InterAccountTransfer[]>(TRANSFERS_KEY(companyId), []);
}

export function saveTransfers(companyId: string, transfers: InterAccountTransfer[]): void {
  writeJson(TRANSFERS_KEY(companyId), transfers);
}

export function loadAvoirs(companyId: string): AvoirFinancier[] {
  return readJson<AvoirFinancier[]>(AVOIRS_KEY(companyId), []);
}

export function saveAvoirs(companyId: string, avoirs: AvoirFinancier[]): void {
  writeJson(AVOIRS_KEY(companyId), avoirs);
}

export function loadAvoirsParArticle(companyId: string): AvoirParArticle[] {
  return readJson<AvoirParArticle[]>(AVOIRS_ARTICLE_KEY(companyId), []);
}

export function saveAvoirsParArticle(companyId: string, avoirs: AvoirParArticle[]): void {
  writeJson(AVOIRS_ARTICLE_KEY(companyId), avoirs);
}

export function loadWithholdingCertificates(companyId: string): WithholdingCertificate[] {
  return readJson<WithholdingCertificate[]>(WITHHOLDING_KEY(companyId), []);
}

export function saveWithholdingCertificates(companyId: string, certs: WithholdingCertificate[]): void {
  writeJson(WITHHOLDING_KEY(companyId), certs);
}

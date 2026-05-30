/**
 * Frais bancaires — persistance locale par société.
 */

import type { BankFeeCharge, BankFeeTypeDefinition } from '../types/financeDomain';
import { FRAIS_BANCAIRES_TYPES } from '../lib/constants';

const FEES_KEY = (companyId: string) => `finance_bank_fees_v1_${companyId}`;
const TYPES_KEY = (companyId: string) => `finance_bank_fee_types_v1_${companyId}`;

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

export function defaultBankFeeTypes(): BankFeeTypeDefinition[] {
  return FRAIS_BANCAIRES_TYPES.map((t) => ({ id: t.id, label: t.label, builtin: true }));
}

export function loadBankFeeTypes(companyId: string): BankFeeTypeDefinition[] {
  const custom = readJson<BankFeeTypeDefinition[]>(TYPES_KEY(companyId), []);
  const builtins = defaultBankFeeTypes();
  const customOnly = custom.filter((c) => !builtins.some((b) => b.id === c.id));
  return [...builtins, ...customOnly];
}

export function saveCustomBankFeeType(companyId: string, label: string): BankFeeTypeDefinition {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Libellé obligatoire.');
  const id = `custom-${Date.now()}`;
  const entry: BankFeeTypeDefinition = { id, label: trimmed, builtin: false };
  const custom = readJson<BankFeeTypeDefinition[]>(TYPES_KEY(companyId), []);
  custom.push(entry);
  writeJson(TYPES_KEY(companyId), custom);
  return entry;
}

export function loadBankFees(companyId: string): BankFeeCharge[] {
  return readJson<BankFeeCharge[]>(FEES_KEY(companyId), []);
}

export function saveBankFees(companyId: string, fees: BankFeeCharge[]): void {
  writeJson(FEES_KEY(companyId), fees);
}

export function addBankFee(companyId: string, fee: Omit<BankFeeCharge, 'id' | 'createdAt'>): BankFeeCharge {
  const row: BankFeeCharge = {
    ...fee,
    id: `bf-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const all = loadBankFees(companyId);
  all.unshift(row);
  saveBankFees(companyId, all);
  return row;
}

export function updateBankFeeStatus(
  companyId: string,
  feeId: string,
  status: BankFeeCharge['status']
): void {
  const all = loadBankFees(companyId);
  const idx = all.findIndex((f) => f.id === feeId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status };
  saveBankFees(companyId, all);
}

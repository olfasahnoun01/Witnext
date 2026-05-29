/**
 * API Avoirs financiers — persistance locale + synchronisation crédit en lettrage.
 */

import type { AvoirFinancier, AvoirFinancierLine, AvoirFinancierType } from '../types/financeDomain';
import { computeAvoirLineTotals, computeAvoirTotals } from './financeService';
import { loadAvoirs, saveAvoirs } from './treasuryStorage';
import type { TauxTvaTunisie } from '../types/financeDomain';

export function listAvoirs(companyId: string, type?: AvoirFinancierType): AvoirFinancier[] {
  const all = loadAvoirs(companyId);
  if (!type) return all;
  return all.filter((a) => a.type === type);
}

export function listAvoirsForCounterparty(
  companyId: string,
  type: AvoirFinancierType,
  counterpartyId: number
): AvoirFinancier[] {
  return listAvoirs(companyId, type).filter(
    (a) => a.counterpartyId === counterpartyId && a.status === 'valide' && a.creditRestant > 0
  );
}

export function createAvoirFinancier(input: {
  companyId: string;
  type: AvoirFinancierType;
  numero: string;
  issueDate: string;
  counterpartyId: number;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  lignes: Array<{ description: string; montantHt: number; tauxTva: TauxTvaTunisie }>;
  notes?: string;
  valider?: boolean;
}): AvoirFinancier {
  const lignes: AvoirFinancierLine[] = input.lignes.map((l, i) =>
    computeAvoirLineTotals({
      id: `ln-${i}`,
      description: l.description,
      montantHt: l.montantHt,
      tauxTva: l.tauxTva,
      montantTva: 0,
      montantTtc: 0,
    })
  );
  const totals = computeAvoirTotals(lignes);
  const avoir: AvoirFinancier = {
    id: `av-${Date.now()}`,
    companyId: input.companyId,
    type: input.type,
    numero: input.numero,
    issueDate: input.issueDate,
    counterpartyId: input.counterpartyId,
    counterpartyName: input.counterpartyName,
    counterpartyTaxId: input.counterpartyTaxId,
    lignes,
    ...totals,
    creditRestant: input.valider ? totals.totalTtc : 0,
    status: input.valider ? 'valide' : 'brouillon',
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  const all = loadAvoirs(input.companyId);
  all.unshift(avoir);
  saveAvoirs(input.companyId, all);
  return avoir;
}

/** Consomme du crédit avoir lors d'un lettrage. */
export function applyAvoirCredit(companyId: string, avoirId: string, amount: number): void {
  const all = loadAvoirs(companyId);
  const idx = all.findIndex((a) => a.id === avoirId);
  if (idx < 0) return;
  const next = [...all];
  next[idx] = {
    ...next[idx],
    creditRestant: Math.max(0, next[idx].creditRestant - amount),
  };
  saveAvoirs(companyId, next);
}

export function generateAvoirNumero(type: AvoirFinancierType): string {
  const prefix = type === 'vente' ? 'AV-CLI' : 'AV-FRS';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

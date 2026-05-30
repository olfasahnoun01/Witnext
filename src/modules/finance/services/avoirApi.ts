/**
 * API Avoirs financiers — persistance locale + synchronisation crédit en lettrage.
 */

import type {
  AvoirFinancier,
  AvoirFinancierLine,
  AvoirFinancierType,
  AvoirParArticle,
  AvoirParArticleLine,
  TauxTvaTunisie,
} from '../types/financeDomain';
import { computeAvoirLineTotals, computeAvoirTotals } from './financeService';
import { loadAvoirs, loadAvoirsParArticle, saveAvoirs, saveAvoirsParArticle } from './treasuryStorage';

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
  const financial = listAvoirs(companyId, type).filter(
    (a) => a.counterpartyId === counterpartyId && a.status === 'valide' && a.creditRestant > 0
  );
  const articleAsFinancial = listAvoirsParArticle(companyId, type)
    .filter((a) => a.counterpartyId === counterpartyId && a.status === 'valide' && a.creditRestant > 0)
    .map(articleAvoirToLetterageShape);
  return [...financial, ...articleAsFinancial];
}

function articleAvoirToLetterageShape(a: AvoirParArticle): AvoirFinancier {
  return {
    id: a.id,
    companyId: a.companyId,
    type: a.type,
    numero: `${a.numero} (articles)`,
    issueDate: a.issueDate,
    counterpartyId: a.counterpartyId,
    counterpartyName: a.counterpartyName,
    counterpartyTaxId: a.counterpartyTaxId,
    lignes: a.lignes.map((l) => ({
      id: l.id,
      description: l.description,
      montantHt: l.montantHt,
      tauxTva: l.tauxTva,
      montantTva: l.montantTva,
      montantTtc: l.montantTtc,
    })),
    totalHt: a.totalHt,
    totalTva: a.totalTva,
    totalTtc: a.totalTtc,
    creditRestant: a.creditRestant,
    status: a.status,
    notes: a.notes,
    createdAt: a.createdAt,
  };
}

export function listAvoirsParArticle(companyId: string, type?: AvoirFinancierType): AvoirParArticle[] {
  const all = loadAvoirsParArticle(companyId);
  if (!type) return all;
  return all.filter((a) => a.type === type);
}

export function createAvoirParArticle(input: {
  companyId: string;
  type: AvoirFinancierType;
  numero: string;
  issueDate: string;
  invoiceId: string;
  invoiceNumero: string;
  counterpartyId: number;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  lignes: Array<{
    invoiceLineId: string;
    productCode: string | null;
    description: string;
    quantity: number;
    unitPriceHt: number;
    tauxTva: TauxTvaTunisie;
  }>;
  notes?: string;
  valider?: boolean;
}): AvoirParArticle {
  const lignes: AvoirParArticleLine[] = input.lignes.map((l, i) => {
    const montantHt = Math.round(l.quantity * l.unitPriceHt * 1000) / 1000;
    const calc = computeAvoirLineTotals({
      id: `ln-${i}`,
      description: l.description,
      montantHt,
      tauxTva: l.tauxTva,
      montantTva: 0,
      montantTtc: 0,
    });
    return {
      id: `ln-${i}`,
      invoiceLineId: l.invoiceLineId,
      productCode: l.productCode,
      description: l.description,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
      tauxTva: l.tauxTva,
      montantHt: calc.montantHt,
      montantTva: calc.montantTva,
      montantTtc: calc.montantTtc,
    };
  });
  const totals = computeAvoirTotals(lignes);
  const avoir: AvoirParArticle = {
    id: `ava-${Date.now()}`,
    companyId: input.companyId,
    type: input.type,
    numero: input.numero,
    issueDate: input.issueDate,
    invoiceId: input.invoiceId,
    invoiceNumero: input.invoiceNumero,
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
  const all = loadAvoirsParArticle(input.companyId);
  all.unshift(avoir);
  saveAvoirsParArticle(input.companyId, all);
  return avoir;
}

export function generateAvoirArticleNumero(type: AvoirFinancierType): string {
  const prefix = type === 'vente' ? 'AVA-CLI' : 'AVA-FRS';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
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
  const articleAll = loadAvoirsParArticle(companyId);
  const artIdx = articleAll.findIndex((a) => a.id === avoirId);
  if (artIdx >= 0) {
    const next = [...articleAll];
    next[artIdx] = {
      ...next[artIdx],
      creditRestant: Math.max(0, next[artIdx].creditRestant - amount),
    };
    saveAvoirsParArticle(companyId, next);
    return;
  }
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

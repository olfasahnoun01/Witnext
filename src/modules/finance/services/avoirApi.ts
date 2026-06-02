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
import {
  insertAvoir,
  insertAvoirParArticle,
  loadAvoirs,
  loadAvoirsParArticle,
  updateAvoirArticleCreditRestant,
  updateAvoirCreditRestant,
} from './treasuryStorage';

export async function listAvoirs(companyId: string, type?: AvoirFinancierType): Promise<AvoirFinancier[]> {
  const all = await loadAvoirs(companyId);
  if (!type) return all;
  return all.filter((a) => a.type === type);
}

export async function listAvoirsForCounterparty(
  companyId: string,
  type: AvoirFinancierType,
  counterpartyId: number
): Promise<AvoirFinancier[]> {
  const [allFinancial, allArticle] = await Promise.all([
    listAvoirs(companyId, type),
    listAvoirsParArticle(companyId, type),
  ]);
  const financial = allFinancial.filter(
    (a) => a.counterpartyId === counterpartyId && a.status === 'valide' && a.creditRestant > 0
  );
  const articleAsFinancial = allArticle
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

export async function listAvoirsParArticle(
  companyId: string,
  type?: AvoirFinancierType
): Promise<AvoirParArticle[]> {
  const all = await loadAvoirsParArticle(companyId);
  if (!type) return all;
  return all.filter((a) => a.type === type);
}

export async function createAvoirParArticle(input: {
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
}): Promise<AvoirParArticle> {
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
  await insertAvoirParArticle(avoir);
  return avoir;
}

export function generateAvoirArticleNumero(type: AvoirFinancierType): string {
  const prefix = type === 'vente' ? 'AVA-CLI' : 'AVA-FRS';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export async function createAvoirFinancier(input: {
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
}): Promise<AvoirFinancier> {
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
  await insertAvoir(avoir);
  return avoir;
}

/** Consomme du crédit avoir lors d'un lettrage. */
export async function applyAvoirCredit(companyId: string, avoirId: string, amount: number): Promise<void> {
  const articleAll = await loadAvoirsParArticle(companyId);
  const art = articleAll.find((a) => a.id === avoirId);
  if (art) {
    await updateAvoirArticleCreditRestant(avoirId, Math.max(0, art.creditRestant - amount));
    return;
  }
  const all = await loadAvoirs(companyId);
  const fin = all.find((a) => a.id === avoirId);
  if (!fin) return;
  await updateAvoirCreditRestant(avoirId, Math.max(0, fin.creditRestant - amount));
}

export function generateAvoirNumero(type: AvoirFinancierType): string {
  const prefix = type === 'vente' ? 'AV-CLI' : 'AV-FRS';
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

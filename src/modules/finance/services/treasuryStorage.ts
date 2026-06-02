/**
 * Persistance Supabase des comptes de trésorerie, virements, avoirs et
 * certificats de retenue à la source. Chaque table est isolée par société
 * (company_id) et protégée par RLS (membres user_companies uniquement).
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AvoirFinancier,
  AvoirParArticle,
  InterAccountTransfer,
  TreasuryAccount,
  TreasuryAccountType,
  WithholdingCertificate,
} from '../types/financeDomain';

function fail(err: { message?: string } | null, fallback: string): never {
  throw new Error(err?.message || fallback);
}

// ——— Comptes de trésorerie ———

function mapAccountRow(r: {
  id: string;
  company_id: string;
  nom: string;
  type: string;
  code_comptable: string;
  rib: string | null;
  banque_label: string | null;
  solde_actuel: number;
  actif: boolean;
  created_at: string;
}): TreasuryAccount {
  return {
    id: r.id,
    companyId: r.company_id,
    nom: r.nom,
    type: r.type as TreasuryAccountType,
    codeComptable: r.code_comptable,
    rib: r.rib,
    banqueLabel: r.banque_label,
    soldeActuel: Number(r.solde_actuel),
    actif: r.actif,
    createdAt: r.created_at,
  };
}

function accountToRow(companyId: string, a: TreasuryAccount) {
  return {
    id: a.id,
    company_id: companyId,
    nom: a.nom,
    type: a.type,
    code_comptable: a.codeComptable,
    rib: a.rib,
    banque_label: a.banqueLabel,
    solde_actuel: a.soldeActuel,
    actif: a.actif,
    created_at: a.createdAt,
  };
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

export async function loadTreasuryAccounts(companyId: string): Promise<TreasuryAccount[]> {
  const { data, error } = await supabase
    .from('treasury_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (error) fail(error, 'Chargement des comptes de trésorerie impossible');

  if (!data || data.length === 0) {
    const defaults = defaultTreasuryAccounts(companyId);
    await saveTreasuryAccounts(companyId, defaults);
    return defaults;
  }
  return data.map(mapAccountRow);
}

export async function saveTreasuryAccounts(companyId: string, accounts: TreasuryAccount[]): Promise<void> {
  if (accounts.length === 0) return;
  const rows = accounts.map((a) => accountToRow(companyId, a));
  const { error } = await supabase.from('treasury_accounts').upsert(rows, { onConflict: 'id' });
  if (error) fail(error, 'Enregistrement des comptes de trésorerie impossible');
}

// ——— Virements inter-comptes ———

export async function loadTransfers(companyId: string): Promise<InterAccountTransfer[]> {
  const { data, error } = await supabase
    .from('treasury_transfers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Chargement des virements impossible');
  return (data ?? []).map((r) => ({
    id: r.id,
    companyId: r.company_id,
    compteSourceId: r.compte_source_id,
    compteDestinationId: r.compte_destination_id,
    montant: Number(r.montant),
    dateOperation: r.date_operation,
    motif: r.motif,
    createdAt: r.created_at,
  }));
}

export async function insertTransfer(transfer: InterAccountTransfer): Promise<void> {
  const { error } = await supabase.from('treasury_transfers').insert({
    id: transfer.id,
    company_id: transfer.companyId,
    compte_source_id: transfer.compteSourceId,
    compte_destination_id: transfer.compteDestinationId,
    montant: transfer.montant,
    date_operation: transfer.dateOperation,
    motif: transfer.motif,
    created_at: transfer.createdAt,
  });
  if (error) fail(error, 'Enregistrement du virement impossible');
}

// ——— Avoirs financiers ———

function mapAvoirRow(r: Record<string, unknown>): AvoirFinancier {
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    type: r.type as AvoirFinancier['type'],
    numero: r.numero as string,
    issueDate: r.issue_date as string,
    counterpartyId: Number(r.counterparty_id),
    counterpartyName: r.counterparty_name as string,
    counterpartyTaxId: (r.counterparty_tax_id as string | null) ?? null,
    lignes: (r.lignes as AvoirFinancier['lignes']) ?? [],
    totalHt: Number(r.total_ht),
    totalTva: Number(r.total_tva),
    totalTtc: Number(r.total_ttc),
    creditRestant: Number(r.credit_restant),
    status: r.status as AvoirFinancier['status'],
    notes: (r.notes as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function loadAvoirs(companyId: string): Promise<AvoirFinancier[]> {
  const { data, error } = await supabase
    .from('finance_avoirs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Chargement des avoirs impossible');
  return (data ?? []).map(mapAvoirRow);
}

export async function insertAvoir(avoir: AvoirFinancier): Promise<void> {
  const { error } = await supabase.from('finance_avoirs').insert({
    id: avoir.id,
    company_id: avoir.companyId,
    type: avoir.type,
    numero: avoir.numero,
    issue_date: avoir.issueDate,
    counterparty_id: avoir.counterpartyId,
    counterparty_name: avoir.counterpartyName,
    counterparty_tax_id: avoir.counterpartyTaxId,
    lignes: avoir.lignes,
    total_ht: avoir.totalHt,
    total_tva: avoir.totalTva,
    total_ttc: avoir.totalTtc,
    credit_restant: avoir.creditRestant,
    status: avoir.status,
    notes: avoir.notes,
    created_at: avoir.createdAt,
  });
  if (error) fail(error, "Enregistrement de l'avoir impossible");
}

export async function updateAvoirCreditRestant(avoirId: string, creditRestant: number): Promise<void> {
  const { error } = await supabase
    .from('finance_avoirs')
    .update({ credit_restant: creditRestant })
    .eq('id', avoirId);
  if (error) fail(error, "Mise à jour du crédit d'avoir impossible");
}

// ——— Avoirs par article ———

function mapAvoirArticleRow(r: Record<string, unknown>): AvoirParArticle {
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    type: r.type as AvoirParArticle['type'],
    numero: r.numero as string,
    issueDate: r.issue_date as string,
    invoiceId: (r.invoice_id as string | null) ?? '',
    invoiceNumero: (r.invoice_numero as string | null) ?? '',
    counterpartyId: Number(r.counterparty_id),
    counterpartyName: r.counterparty_name as string,
    counterpartyTaxId: (r.counterparty_tax_id as string | null) ?? null,
    lignes: (r.lignes as AvoirParArticle['lignes']) ?? [],
    totalHt: Number(r.total_ht),
    totalTva: Number(r.total_tva),
    totalTtc: Number(r.total_ttc),
    creditRestant: Number(r.credit_restant),
    status: r.status as AvoirParArticle['status'],
    notes: (r.notes as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function loadAvoirsParArticle(companyId: string): Promise<AvoirParArticle[]> {
  const { data, error } = await supabase
    .from('finance_avoirs_article')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Chargement des avoirs par article impossible');
  return (data ?? []).map(mapAvoirArticleRow);
}

export async function insertAvoirParArticle(avoir: AvoirParArticle): Promise<void> {
  const { error } = await supabase.from('finance_avoirs_article').insert({
    id: avoir.id,
    company_id: avoir.companyId,
    type: avoir.type,
    numero: avoir.numero,
    issue_date: avoir.issueDate,
    invoice_id: avoir.invoiceId || null,
    invoice_numero: avoir.invoiceNumero || null,
    counterparty_id: avoir.counterpartyId,
    counterparty_name: avoir.counterpartyName,
    counterparty_tax_id: avoir.counterpartyTaxId,
    lignes: avoir.lignes,
    total_ht: avoir.totalHt,
    total_tva: avoir.totalTva,
    total_ttc: avoir.totalTtc,
    credit_restant: avoir.creditRestant,
    status: avoir.status,
    notes: avoir.notes,
    created_at: avoir.createdAt,
  });
  if (error) fail(error, "Enregistrement de l'avoir par article impossible");
}

export async function updateAvoirArticleCreditRestant(avoirId: string, creditRestant: number): Promise<void> {
  const { error } = await supabase
    .from('finance_avoirs_article')
    .update({ credit_restant: creditRestant })
    .eq('id', avoirId);
  if (error) fail(error, "Mise à jour du crédit d'avoir impossible");
}

// ——— Certificats de retenue à la source ———

export async function loadWithholdingCertificates(companyId: string): Promise<WithholdingCertificate[]> {
  const { data, error } = await supabase
    .from('withholding_certificates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Chargement des certificats de retenue impossible');
  return (data ?? []).map((r) => ({
    id: r.id,
    companyId: r.company_id,
    mode: r.mode as WithholdingCertificate['mode'],
    counterpartyId: Number(r.counterparty_id),
    counterpartyName: r.counterparty_name,
    matriculeFiscal: r.matricule_fiscal,
    paymentId: r.payment_id,
    lignes: (r.lignes as WithholdingCertificate['lignes']) ?? [],
    totalRetenue: Number(r.total_retenue),
    createdAt: r.created_at,
  }));
}

export async function insertWithholdingCertificate(cert: WithholdingCertificate): Promise<void> {
  const { error } = await supabase.from('withholding_certificates').insert({
    id: cert.id,
    company_id: cert.companyId,
    mode: cert.mode,
    counterparty_id: cert.counterpartyId,
    counterparty_name: cert.counterpartyName,
    matricule_fiscal: cert.matriculeFiscal,
    payment_id: cert.paymentId,
    lignes: cert.lignes,
    total_retenue: cert.totalRetenue,
    created_at: cert.createdAt,
  });
  if (error) fail(error, 'Enregistrement du certificat de retenue impossible');
}

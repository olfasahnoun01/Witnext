/**
 * Pont Finance ↔ modules Ventes / Achats / Magasin.
 * Lecture seule sur `devis`, `documents`, `clients`, `fournisseurs`.
 */

import { supabase } from '@/integrations/supabase/client';
import type { DevisItem } from '@/types';
import { computeDevisLine } from '@/lib/devisPricing';
import type { InvoiceWriteInput, VatRate } from '../types';
import type {
  CommercialDevisRow,
  CommercialInvoiceDraft,
  FinanceSourceRef,
  TierDirectoryRow,
  WarehouseDocType,
  WarehouseDocumentRow,
} from '../types/commercialBridge';
import { createPurchaseInvoice, createSalesInvoice } from './financeApi';

function parseDevisItems(raw: unknown): DevisItem[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as DevisItem[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw as DevisItem[];
  return [];
}

function devisKind(row: { is_bc?: boolean; is_ba?: boolean }): CommercialDevisRow['kind'] {
  if (row.is_ba) return 'ba';
  if (row.is_bc) return 'bc';
  return 'devis';
}

/** Liste devis / BC / BA depuis la table legacy `devis`. */
export async function fetchCommercialDevisList(options?: {
  flow?: 'vente' | 'achat';
  kind?: CommercialDevisRow['kind'];
  limit?: number;
}): Promise<CommercialDevisRow[]> {
  let query = supabase
    .from('devis')
    .select('id, devis_number, devis_date, type, is_bc, is_ba, status, third_party_name, third_party_tax_id, total_amount, items, source_devis_id')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 500);

  if (options?.flow) query = query.eq('type', options.flow);
  if (options?.kind === 'devis') query = query.eq('is_bc', false).eq('is_ba', false);
  if (options?.kind === 'bc') query = query.eq('is_bc', true);
  if (options?.kind === 'ba') query = query.eq('is_ba', true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const items = parseDevisItems(row.items);
    return {
      id: row.id,
      kind: devisKind(row),
      flow: row.type as 'vente' | 'achat',
      numero: row.devis_number,
      date: row.devis_date,
      thirdPartyName: row.third_party_name,
      thirdPartyTaxId: row.third_party_tax_id,
      status: row.status,
      totalAmount: Number(row.total_amount) || 0,
      lineCount: items.length,
      sourceDevisId: row.source_devis_id,
    };
  });
}

/** Documents magasin v2 (BL, BE, BS, BC). */
export async function fetchWarehouseDocuments(
  types: WarehouseDocType[],
  limit = 300
): Promise<WarehouseDocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `
      id, type, numero, status, created_at, client_id, fournisseur_id, metadata,
      clients(nom, matricule_fiscale),
      fournisseurs(nom, matricule_fiscale),
      document_lines(quantity, unit_price, total_price)
    `
    )
    .in('type', types)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const client = row.clients as { nom?: string; matricule_fiscale?: string } | null;
    const fournisseur = row.fournisseurs as { nom?: string; matricule_fiscale?: string } | null;
    const lines = (row.document_lines ?? []) as Array<{ quantity: number; unit_price: number; total_price: number }>;
    const totalHt = lines.reduce((s, l) => s + Number(l.total_price || l.quantity * l.unit_price), 0);

    const isClientSide = ['BC_CLIENT', 'BL_CLIENT', 'BS'].includes(String(row.type));
    return {
      id: row.id,
      type: row.type as WarehouseDocType,
      numero: row.numero,
      status: row.status,
      createdAt: row.created_at,
      thirdPartyName: isClientSide ? client?.nom ?? null : fournisseur?.nom ?? null,
      thirdPartyTaxId: isClientSide ? client?.matricule_fiscale ?? null : fournisseur?.matricule_fiscale ?? null,
      clientId: row.client_id,
      fournisseurId: row.fournisseur_id,
      lineCount: lines.length,
      totalHt,
    };
  });
}

/** Annuaire clients (module Ventes). */
export async function fetchClientsDirectory(): Promise<TierDirectoryRow[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, nom, matricule_fiscale, location, phone, email')
    .order('nom');
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    nom: c.nom,
    matriculeFiscale: c.matricule_fiscale,
    location: c.location,
    phone: c.phone,
    email: c.email,
  }));
}

/** Annuaire fournisseurs (module Achats). */
export async function fetchFournisseursDirectory(): Promise<TierDirectoryRow[]> {
  const { data, error } = await supabase
    .from('fournisseurs')
    .select('id, nom, matricule_fiscale, location, phone')
    .order('nom');
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({
    id: f.id,
    nom: f.nom,
    matriculeFiscale: f.matricule_fiscale,
    location: f.location,
    phone: f.phone,
  }));
}

function devisItemsToLines(items: DevisItem[], isTtc: boolean, isPurchase: boolean): CommercialInvoiceDraft['lines'] {
  return items.map((item) => {
    const pricing = computeDevisLine(item, isTtc);
    return {
      product_code: item.sku || null,
      description: item.designation || item.description || 'Article',
      quantity: item.quantity,
      unit_price_ht: pricing.unitAfterRemiseHT,
      vat_rate: (item.tva ?? 19) as VatRate,
      subject_to_fodec: isPurchase,
    };
  });
}

function suggestInvoiceNumero(sourceNumero: string, prefix: 'FV' | 'FA'): string {
  const clean = sourceNumero.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24);
  return `${prefix}-${clean}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/** Charge un devis complet et produit un brouillon facture Finance. */
export async function buildDraftFromDevis(devisId: number): Promise<CommercialInvoiceDraft> {
  const { data, error } = await supabase.from('devis').select('*').eq('id', devisId).single();
  if (error || !data) throw new Error('Devis introuvable');

  const items = parseDevisItems(data.items);
  const flow = data.type as 'vente' | 'achat';
  const kind = devisKind(data);
  const invoiceType = flow === 'vente' ? 'vente' : 'achat';

  const source_ref: FinanceSourceRef = {
    module: 'devis',
    doc_kind: kind,
    source_id: String(data.id),
    source_numero: data.devis_number,
  };

  return {
    invoiceType,
    numero: suggestInvoiceNumero(data.devis_number, invoiceType === 'vente' ? 'FV' : 'FA'),
    counterpart_name: data.third_party_name || 'Tiers non renseigné',
    counterpart_tax_id: data.third_party_tax_id,
    issue_date: data.devis_date || new Date().toISOString().slice(0, 10),
    notes: data.notes ? `Origine ${kind} ${data.devis_number} — ${data.notes}` : `Origine ${kind} ${data.devis_number}`,
    apply_timbre_fiscal: invoiceType === 'vente',
    lines:
      items.length > 0
        ? devisItemsToLines(items, !!data.is_ttc, invoiceType === 'achat')
        : [{ description: `Reprise ${data.devis_number}`, quantity: 1, unit_price_ht: Number(data.total_amount) || 0, vat_rate: 19 }],
    source_ref,
  };
}

/** Charge un document magasin et produit un brouillon facture Finance. */
export async function buildDraftFromWarehouseDocument(documentId: string): Promise<CommercialInvoiceDraft> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `
      *,
      clients(nom, matricule_fiscale),
      fournisseurs(nom, matricule_fiscale),
      document_lines(*, products(sku, name))
    `
    )
    .eq('id', documentId)
    .single();

  if (error || !data) throw new Error('Document introuvable');

  const docType = data.type as WarehouseDocType;
  const client = data.clients as { nom?: string; matricule_fiscale?: string } | null;
  const fournisseur = data.fournisseurs as { nom?: string; matricule_fiscale?: string } | null;
  const lines = (data.document_lines ?? []) as Array<{
    quantity: number;
    unit_price: number;
    description: string | null;
    products?: { sku?: string; name?: string } | null;
  }>;

  const clientSide = ['BC_CLIENT', 'BL_CLIENT', 'BS'].includes(docType);
  const invoiceType = clientSide ? 'vente' : 'achat';

  const source_ref: FinanceSourceRef = {
    module: 'documents',
    doc_kind: docType,
    source_id: data.id,
    source_numero: data.numero,
    counterparty_id: clientSide ? data.client_id : data.fournisseur_id,
  };

  return {
    invoiceType,
    numero: suggestInvoiceNumero(data.numero, invoiceType === 'vente' ? 'FV' : 'FA'),
    counterpart_name: clientSide ? client?.nom || 'Client' : fournisseur?.nom || 'Fournisseur',
    counterpart_tax_id: clientSide ? client?.matricule_fiscale ?? null : fournisseur?.matricule_fiscale ?? null,
    issue_date: new Date(data.created_at).toISOString().slice(0, 10),
    notes: `Origine ${docType} ${data.numero}`,
    apply_timbre_fiscal: invoiceType === 'vente',
    lines:
      lines.length > 0
        ? lines.map((l) => ({
            product_code: l.products?.sku || null,
            description: l.description || l.products?.name || 'Article',
            quantity: Number(l.quantity),
            unit_price_ht: Number(l.unit_price),
            vat_rate: 19 as VatRate,
            subject_to_fodec: invoiceType === 'achat',
          }))
        : [{ description: `Reprise ${data.numero}`, quantity: 1, unit_price_ht: 0, vat_rate: 19 }],
    source_ref,
  };
}

/** Vérifie si une pièce source a déjà une facture Finance brouillon/validée. */
export async function findExistingFinanceInvoiceBySource(
  companyId: string,
  sourceRef: FinanceSourceRef
): Promise<string | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, numero, metadata, status')
    .eq('company_id', companyId)
    .neq('status', 'void');

  if (error) throw new Error(error.message);

  const match = (data ?? []).find((inv) => {
    const meta = (inv.metadata || {}) as Record<string, unknown>;
    const ref = meta.source_ref as FinanceSourceRef | undefined;
    if (!ref) return false;
    if (ref.source_id === sourceRef.source_id) return true;
    if (ref.grouped_source_ids?.includes(sourceRef.source_id)) return true;
    return false;
  });

  return match?.numero ?? null;
}

function draftToWriteInput(companyId: string, draft: CommercialInvoiceDraft): InvoiceWriteInput & { source_ref: FinanceSourceRef } {
  return {
    company_id: companyId,
    numero: draft.numero,
    counterpart_name: draft.counterpart_name,
    counterpart_tax_id: draft.counterpart_tax_id,
    issue_date: draft.issue_date,
    notes: draft.notes,
    apply_timbre_fiscal: draft.apply_timbre_fiscal,
    lines: draft.lines,
    source_ref: draft.source_ref,
  };
}

async function insertWithSourceRef(input: InvoiceWriteInput & { source_ref?: FinanceSourceRef }, invoiceType: 'vente' | 'achat') {
  const { source_ref, ...base } = input;
  const existing = source_ref ? await findExistingFinanceInvoiceBySource(base.company_id, source_ref) : null;
  if (existing) {
    throw new Error(`Une facture Finance existe déjà pour cette pièce : ${existing}`);
  }

  const payload: InvoiceWriteInput = {
    ...base,
    notes: base.notes,
  };

  // Extend metadata via financeApi by patching insert — we pass source in notes metadata through a wrapper
  const id =
    invoiceType === 'vente'
      ? await createSalesInvoiceWithSource(payload, source_ref)
      : await createPurchaseInvoiceWithSource(payload, source_ref);
  return id;
}

async function createSalesInvoiceWithSource(input: InvoiceWriteInput, source_ref?: FinanceSourceRef) {
  return createFinanceInvoiceWithSource(input, 'vente', source_ref);
}

async function createPurchaseInvoiceWithSource(input: InvoiceWriteInput, source_ref?: FinanceSourceRef) {
  return createFinanceInvoiceWithSource(input, 'achat', source_ref);
}

/** Creates invoice and patches metadata with source_ref. */
async function createFinanceInvoiceWithSource(
  input: InvoiceWriteInput,
  invoiceType: 'vente' | 'achat',
  source_ref?: FinanceSourceRef
): Promise<string> {
  const createFn = invoiceType === 'vente' ? createSalesInvoice : createPurchaseInvoice;
  const id = await createFn(input);

  if (source_ref) {
    const { data: row } = await supabase.from('invoices').select('metadata').eq('id', id).single();
    const meta = ((row?.metadata || {}) as Record<string, unknown>) ?? {};
    await supabase
      .from('invoices')
      .update({ metadata: { ...meta, source_ref } })
      .eq('id', id);
  }

  return id;
}

/** Crée une facture Finance brouillon depuis une pièce commerciale. */
export async function createFinanceInvoiceFromDevis(companyId: string, devisId: number): Promise<string> {
  const draft = await buildDraftFromDevis(devisId);
  return insertWithSourceRef(draftToWriteInput(companyId, draft), draft.invoiceType);
}

/** Crée une facture Finance brouillon depuis un document magasin. */
export async function createFinanceInvoiceFromDocument(companyId: string, documentId: string): Promise<string> {
  const draft = await buildDraftFromWarehouseDocument(documentId);
  return insertWithSourceRef(draftToWriteInput(companyId, draft), draft.invoiceType);
}

/** Fusionne plusieurs BL (même tiers) en une facture Finance brouillon. */
export async function buildDraftFromGroupedWarehouseDocuments(
  documentIds: string[]
): Promise<CommercialInvoiceDraft> {
  if (documentIds.length === 0) throw new Error('Sélectionnez au moins un BL.');
  const drafts = await Promise.all(documentIds.map((id) => buildDraftFromWarehouseDocument(id)));

  const invoiceType = drafts[0].invoiceType;
  const mismatched = drafts.find((d) => d.invoiceType !== invoiceType);
  if (mismatched) throw new Error('Les BL sélectionnés doivent être du même sens (vente ou achat).');

  const uniqueCounterparts = new Set(
    drafts.map((d) => `${d.counterpart_name}|${d.counterpart_tax_id || ''}`)
  );
  if (uniqueCounterparts.size > 1) {
    throw new Error('Les BL sélectionnés doivent concerner le même tiers.');
  }

  const numeros = drafts.map((d) => d.source_ref.source_numero);
  const groupedIds = drafts.map((d) => d.source_ref.source_id);
  const first = drafts[0];

  const source_ref: FinanceSourceRef = {
    module: 'documents',
    doc_kind: first.source_ref.doc_kind,
    source_id: groupedIds[0],
    source_numero: numeros.join(' + '),
    counterparty_id: first.source_ref.counterparty_id,
    grouped_source_ids: groupedIds,
    grouped_source_numeros: numeros,
  };

  return {
    invoiceType,
    numero: suggestInvoiceNumero(numeros.join('-'), invoiceType === 'vente' ? 'FV' : 'FA'),
    counterpart_name: first.counterpart_name,
    counterpart_tax_id: first.counterpart_tax_id,
    issue_date: drafts.reduce((max, d) => (d.issue_date > max ? d.issue_date : max), first.issue_date),
    notes: `Regroupement BL : ${numeros.join(', ')}`,
    apply_timbre_fiscal: invoiceType === 'vente',
    lines: drafts.flatMap((d) => d.lines),
    source_ref,
  };
}

export async function createFinanceInvoiceFromGroupedDocuments(
  companyId: string,
  documentIds: string[]
): Promise<string> {
  for (const id of documentIds) {
    const draft = await buildDraftFromWarehouseDocument(id);
    const existing = await findExistingFinanceInvoiceBySource(companyId, draft.source_ref);
    if (existing) {
      throw new Error(`Une facture existe déjà pour ${draft.source_ref.source_numero} : ${existing}`);
    }
  }
  const draft = await buildDraftFromGroupedWarehouseDocuments(documentIds);
  const id = await insertWithSourceRef(draftToWriteInput(companyId, draft), draft.invoiceType);
  const { data: row } = await supabase.from('invoices').select('numero').eq('id', id).single();
  return row?.numero ?? draft.numero;
}

export { draftToWriteInput };

/**
 * Cross-table resolver: Devis client → BC client → BC fournisseur → Facture fournisseur → BL vente → Facture client.
 * Reads Grosafe commercial tables (devis, documents, factures) + finance purchase invoices for the active company.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FinanceSourceRef } from '../types/commercialBridge';
import type {
  CommercialOperation,
  OperationDocModule,
  OperationStep,
  OperationStepKey,
  OperationStepRef,
  OperationStepStatus,
} from '../types/commercialOperations';
import { OPERATION_STEP_LABELS, OPERATION_STEP_ORDER } from '../types/commercialOperations';

interface DevisRow {
  id: number;
  devis_number: string;
  devis_date: string;
  type: string;
  is_bc: boolean;
  is_ba: boolean;
  status: string;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  total_amount: number | null;
  items: unknown;
  source_devis_id: number | null;
  is_ttc: boolean;
  notes: string | null;
  created_at: string;
}

interface DocRow {
  id: string;
  type: string;
  numero: string;
  status: string;
  created_at: string;
  parent_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface FactureRow {
  id: string;
  numero: string;
  type: string;
  status: string;
  date_creation: string;
  source_bc_id: number | null;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  items: unknown;
  total_amount: number;
  is_ttc: boolean;
  notes: string | null;
  date_echeance: string | null;
}

interface FinanceInvoiceRow {
  id: string;
  numero: string;
  status: string;
  issue_date: string;
  metadata: Record<string, unknown> | null;
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = meta?.[key];
  if (v == null) return null;
  return String(v);
}

function devisStepStatus(status: string): OperationStepStatus {
  const s = (status || 'brouillon').toLowerCase();
  if (['accepté', 'confirmé', 'intégré', 'reçu'].includes(s)) return 'done';
  if (['envoyé'].includes(s)) return 'in_progress';
  if (s === 'brouillon') return 'draft';
  if (s === 'refusé') return 'missing';
  return 'in_progress';
}

function documentStepStatus(type: string, status: string): OperationStepStatus {
  const s = (status || '').toUpperCase();
  if (['VALIDATED', 'COMPLETED'].includes(s)) return 'done';
  if (['PENDING', 'PARTIALLY_RECEIVED'].includes(s)) return 'in_progress';
  if (s === 'DRAFT') return 'draft';
  if (s === 'REJECTED') return 'missing';
  return type === 'BE' && s === 'VALIDATED' ? 'done' : 'in_progress';
}

function factureStepStatus(status: string): OperationStepStatus {
  const s = (status || 'brouillon').toLowerCase();
  if (['payée', 'envoyée'].includes(s)) return 'done';
  if (s === 'brouillon') return 'draft';
  if (s === 'annulée') return 'missing';
  return 'in_progress';
}

function financeInvoiceStepStatus(status: string): OperationStepStatus {
  const s = (status || 'draft').toLowerCase();
  if (['issued', 'partial', 'paid'].includes(s)) return 'done';
  if (s === 'draft') return 'draft';
  if (s === 'void') return 'missing';
  return 'in_progress';
}

function makeRef(
  module: OperationDocModule,
  id: string,
  numero: string,
  date?: string,
  status?: string,
  previewPayload?: unknown
): OperationStepRef {
  return { module, id, numero, date, status, previewPayload };
}

function buildStep(
  key: OperationStepKey,
  status: OperationStepStatus,
  ref?: OperationStepRef,
  hint?: string
): OperationStep {
  return { key, label: OPERATION_STEP_LABELS[key], status, ref, hint };
}

function parseSourceRef(meta: Record<string, unknown> | null): FinanceSourceRef | null {
  const raw = meta?.source_ref;
  if (!raw || typeof raw !== 'object') return null;
  return raw as FinanceSourceRef;
}

function computeCompletion(steps: OperationStep[]): {
  completionPercent: number;
  completedSteps: number;
  blockedAt?: OperationStepKey;
  isComplete: boolean;
} {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const completionPercent = Math.round((doneCount / steps.length) * 100);
  const blocked = steps.find((s) => s.status === 'missing' || s.status === 'draft');
  return {
    completionPercent,
    completedSteps: doneCount,
    blockedAt: blocked?.key,
    isComplete: doneCount === steps.length,
  };
}

export async function fetchCommercialOperations(companyId: string): Promise<CommercialOperation[]> {
  const [bcRes, docsRes, facturesRes, financeRes] = await Promise.all([
    supabase
      .from('devis')
      .select(
        'id, devis_number, devis_date, type, is_bc, is_ba, status, third_party_name, third_party_address, third_party_tax_id, third_party_phone, total_amount, items, source_devis_id, is_ttc, notes, created_at'
      )
      .eq('is_bc', true)
      .eq('type', 'vente')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('documents')
      .select('id, type, numero, status, created_at, parent_id, metadata')
      .in('type', ['BC_CLIENT', 'BC_FOURNISSEUR', 'BL_CLIENT', 'BE', 'DEVIS_FOURNISSEUR'])
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('factures')
      .select(
        'id, numero, type, status, date_creation, source_bc_id, third_party_name, third_party_address, third_party_tax_id, third_party_phone, items, total_amount, is_ttc, notes, date_echeance'
      )
      .eq('type', 'vente')
      .not('source_bc_id', 'is', null),
    supabase
      .from('invoices')
      .select('id, numero, status, issue_date, metadata')
      .eq('company_id', companyId)
      .eq('invoice_type', 'achat')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (bcRes.error) throw new Error(bcRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (facturesRes.error) throw new Error(facturesRes.error.message);
  if (financeRes.error) throw new Error(financeRes.error.message);

  const bcs = (bcRes.data ?? []) as DevisRow[];
  const docs = (docsRes.data ?? []) as DocRow[];
  const factures = (facturesRes.data ?? []) as FactureRow[];
  const financeInvoices = (financeRes.data ?? []) as FinanceInvoiceRow[];

  const sourceDevisIds = [...new Set(bcs.map((b) => b.source_devis_id).filter((id): id is number => id != null))];
  let devisById = new Map<number, DevisRow>();
  for (const bc of bcs) devisById.set(bc.id, bc);

  if (sourceDevisIds.length > 0) {
    const { data: sourceDevis, error } = await supabase
      .from('devis')
      .select(
        'id, devis_number, devis_date, type, is_bc, is_ba, status, third_party_name, third_party_address, third_party_tax_id, third_party_phone, total_amount, items, source_devis_id, is_ttc, notes, created_at'
      )
      .in('id', sourceDevisIds);
    if (error) throw new Error(error.message);
    for (const d of (sourceDevis ?? []) as DevisRow[]) devisById.set(d.id, d);
  }

  const promotedBcByLegacyId = new Map<string, string>();
  for (const d of docs) {
    if (d.type === 'BC_CLIENT') {
      const legacy = metaString(d.metadata, 'legacy_id');
      if (legacy) promotedBcByLegacyId.set(legacy, d.id);
    }
  }

  const bcFournisseurByVenteDevisId = new Map<number, DocRow[]>();
  for (const d of docs) {
    if (d.type !== 'BC_FOURNISSEUR') continue;
    const vid = metaString(d.metadata, 'vente_devis_id');
    if (vid) {
      const n = parseInt(vid, 10);
      if (!Number.isNaN(n)) {
        const list = bcFournisseurByVenteDevisId.get(n) ?? [];
        list.push(d);
        bcFournisseurByVenteDevisId.set(n, list);
      }
    }
  }

  const childrenByParentId = new Map<string, DocRow[]>();
  for (const d of docs) {
    if (!d.parent_id) continue;
    const list = childrenByParentId.get(d.parent_id) ?? [];
    list.push(d);
    childrenByParentId.set(d.parent_id, list);
  }

  const factureByBcId = new Map<number, FactureRow>();
  for (const f of factures) {
    if (f.source_bc_id != null) factureByBcId.set(f.source_bc_id, f);
  }

  const financeBySourceId = new Map<string, FinanceInvoiceRow>();
  for (const inv of financeInvoices) {
    const ref = parseSourceRef(inv.metadata);
    if (ref?.source_id) financeBySourceId.set(ref.source_id, inv);
    if (ref?.grouped_source_ids?.length) {
      for (const gid of ref.grouped_source_ids) financeBySourceId.set(gid, inv);
    }
  }

  function resolveBcFournisseurs(bc: DevisRow): DocRow[] {
    const fromMeta = bcFournisseurByVenteDevisId.get(bc.id) ?? [];
    const promotedId = promotedBcByLegacyId.get(String(bc.id));
    const fromParent = promotedId
      ? (childrenByParentId.get(promotedId) ?? []).filter((d) => d.type === 'BC_FOURNISSEUR')
      : [];
    const seen = new Set<string>();
    const merged: DocRow[] = [];
    for (const d of [...fromMeta, ...fromParent]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
    return merged;
  }

  function resolveBlVente(bc: DevisRow): DocRow | null {
    const promotedId = promotedBcByLegacyId.get(String(bc.id));
    if (!promotedId) return null;
    const children = childrenByParentId.get(promotedId) ?? [];
    return children.find((d) => d.type === 'BL_CLIENT') ?? null;
  }

  function resolveBeForBcFournisseur(bcFournisseur: DocRow): DocRow | null {
    const children = childrenByParentId.get(bcFournisseur.id) ?? [];
    return children.find((d) => d.type === 'BE') ?? null;
  }

  function resolveFinancePurchase(bcFournisseur: DocRow, be: DocRow | null): FinanceInvoiceRow | null {
    const direct = financeBySourceId.get(bcFournisseur.id);
    if (direct) return direct;
    if (be) {
      const fromBe = financeBySourceId.get(be.id);
      if (fromBe) return fromBe;
    }
    return null;
  }

  return bcs.map((bc): CommercialOperation => {
    const devisClient = bc.source_devis_id ? devisById.get(bc.source_devis_id) : undefined;
    const bcFournisseurs = resolveBcFournisseurs(bc);
    const primaryBcF = bcFournisseurs[0] ?? null;
    const be = primaryBcF ? resolveBeForBcFournisseur(primaryBcF) : null;
    const financePurchase = primaryBcF ? resolveFinancePurchase(primaryBcF, be) : null;
    const bl = resolveBlVente(bc);
    const factureClient = factureByBcId.get(bc.id);

    const stepDevisClient = devisClient
      ? buildStep(
          'devis_client',
          devisStepStatus(devisClient.status),
          makeRef(
            'devis',
            String(devisClient.id),
            devisClient.devis_number,
            devisClient.devis_date,
            devisClient.status,
            devisClient
          )
        )
      : buildStep('devis_client', 'missing');

    const stepBcClient = buildStep(
      'bc_client',
      devisStepStatus(bc.status),
      makeRef('devis', String(bc.id), bc.devis_number, bc.devis_date, bc.status, bc)
    );

    const stepBcFournisseur = primaryBcF
      ? buildStep(
          'bc_fournisseur',
          documentStepStatus(primaryBcF.type, primaryBcF.status),
          makeRef(
            'documents',
            primaryBcF.id,
            primaryBcF.numero,
            primaryBcF.created_at.slice(0, 10),
            primaryBcF.status,
            primaryBcF
          ),
          bcFournisseurs.length > 1 ? `${bcFournisseurs.length} BC fournisseur(s)` : undefined
        )
      : buildStep('bc_fournisseur', 'missing');

    let stepFactureFournisseur: OperationStep;
    if (financePurchase) {
      stepFactureFournisseur = buildStep(
        'facture_fournisseur',
        financeInvoiceStepStatus(financePurchase.status),
        makeRef(
          'finance',
          financePurchase.id,
          financePurchase.numero,
          financePurchase.issue_date,
          financePurchase.status,
          financePurchase
        )
      );
    } else if (be) {
      stepFactureFournisseur = buildStep(
        'facture_fournisseur',
        documentStepStatus(be.type, be.status) === 'done' ? 'in_progress' : documentStepStatus(be.type, be.status),
        makeRef('documents', be.id, be.numero, be.created_at.slice(0, 10), be.status, be),
        'BE magasin — facture Finance non liée'
      );
    } else {
      stepFactureFournisseur = buildStep('facture_fournisseur', 'missing');
    }

    const stepBl = bl
      ? buildStep(
          'bl_vente',
          documentStepStatus(bl.type, bl.status),
          makeRef('documents', bl.id, bl.numero, bl.created_at.slice(0, 10), bl.status, bl)
        )
      : buildStep('bl_vente', 'missing');

    const stepFactureClient = factureClient
      ? buildStep(
          'facture_client',
          factureStepStatus(factureClient.status),
          makeRef(
            'factures',
            factureClient.id,
            factureClient.numero,
            factureClient.date_creation,
            factureClient.status,
            factureClient
          )
        )
      : buildStep('facture_client', 'missing');

    const steps = [
      stepDevisClient,
      stepBcClient,
      stepBcFournisseur,
      stepFactureFournisseur,
      stepBl,
      stepFactureClient,
    ];

    const { completionPercent, completedSteps, blockedAt, isComplete } = computeCompletion(steps);

    return {
      bcClientId: bc.id,
      clientName: bc.third_party_name || 'Client inconnu',
      bcNumero: bc.devis_number,
      devisClientNumero: devisClient?.devis_number ?? null,
      createdAt: bc.created_at,
      bcStatus: bc.status,
      steps,
      completionPercent,
      completedSteps,
      blockedAt,
      isComplete,
    };
  });
}

export type OperationsFilter = 'all' | 'complete' | 'incomplete';

export function filterOperations(
  ops: CommercialOperation[],
  opts: {
    search?: string;
    statusFilter?: OperationsFilter;
    dateFrom?: string;
    dateTo?: string;
  }
): CommercialOperation[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  return ops.filter((op) => {
    if (opts.statusFilter === 'complete' && !op.isComplete) return false;
    if (opts.statusFilter === 'incomplete' && op.isComplete) return false;
    if (opts.dateFrom && op.createdAt.slice(0, 10) < opts.dateFrom) return false;
    if (opts.dateTo && op.createdAt.slice(0, 10) > opts.dateTo) return false;
    if (!q) return true;
    return (
      op.clientName.toLowerCase().includes(q) ||
      op.bcNumero.toLowerCase().includes(q) ||
      (op.devisClientNumero?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function operationsSummary(ops: CommercialOperation[]) {
  const total = ops.length;
  const complete = ops.filter((o) => o.isComplete).length;
  const inProgress = ops.filter((o) => !o.isComplete && o.completedSteps > 0).length;
  const blocked = ops.filter((o) => !o.isComplete && o.completedSteps === 0).length;
  return { total, complete, inProgress, blocked };
}

export { OPERATION_STEP_ORDER };

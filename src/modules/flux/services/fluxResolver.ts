/**
 * Cross-table resolver for commercial flux dossiers (13 steps).
 * Extends finance commercialOperationsTracker with legacy BL, source_bl_id factures, BE/BS/preparation.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FinanceSourceRef } from '@/modules/finance/types/commercialBridge';
import type {
  AssignedRole,
  CommercialDossierRow,
  DossierCheckpointRow,
  FluxDossierDetail,
  FluxDocModule,
  FluxStep,
  FluxStepKey,
  FluxStepRef,
  FluxStepStatus,
} from '../types/dossierTypes';
import {
  FLUX_REQUIRED_STEPS,
  FLUX_STEP_LABELS,
  FLUX_STEP_ORDER,
  FLUX_STEP_OWNER,
  FLUX_STEP_SHORT_CHIP,
} from '../types/dossierTypes';
import { queryDevisFluxRows, queryDevisFluxRowsLite, resolveBcIdFromBlRow } from './devisFluxFields';

interface DevisRow {
  id: number;
  devis_number: string;
  devis_date: string;
  type: string;
  is_bc: boolean;
  is_ba: boolean;
  is_bl?: boolean;
  status: string;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  total_amount: number | null;
  items: unknown;
  source_devis_id: number | null;
  source_bc_id?: number | null;
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
  source_bl_id?: number | null;
  third_party_name: string | null;
  items: unknown;
  total_amount: number;
  is_ttc: boolean;
  notes: string | null;
}

interface FinanceInvoiceRow {
  id: string;
  numero: string;
  status: string;
  issue_date: string;
  metadata: Record<string, unknown> | null;
}

export interface FluxContextData {
  devisById: Map<number, DevisRow>;
  legacyBlByBcId: Map<number, DevisRow>;
  docs: DocRow[];
  factures: FactureRow[];
  financeInvoices: FinanceInvoiceRow[];
  promotedBcByLegacyId: Map<string, string>;
  bcFournisseurByVenteDevisId: Map<number, DocRow[]>;
  childrenByParentId: Map<string, DocRow[]>;
  factureByBcId: Map<number, FactureRow>;
  factureByBlId: Map<number, FactureRow>;
  financeBySourceId: Map<string, FinanceInvoiceRow>;
  demandeAchatByBcDocId: Map<string, DocRow>;
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = meta?.[key];
  if (v == null) return null;
  return String(v);
}

function devisStepStatus(status: string): FluxStepStatus {
  const s = (status || 'brouillon').toLowerCase();
  if (['accepté', 'confirmé', 'intégré', 'reçu'].includes(s)) return 'done';
  if (['envoyé'].includes(s)) return 'in_progress';
  if (s === 'brouillon') return 'draft';
  if (s === 'refusé') return 'missing';
  return 'in_progress';
}

function documentStepStatus(status: string): FluxStepStatus {
  const s = (status || '').toUpperCase();
  if (['VALIDATED', 'COMPLETED'].includes(s)) return 'done';
  if (['PENDING', 'PARTIALLY_RECEIVED'].includes(s)) return 'in_progress';
  if (s === 'DRAFT') return 'draft';
  if (s === 'REJECTED') return 'missing';
  return 'in_progress';
}

function factureStepStatus(status: string): FluxStepStatus {
  const s = (status || 'brouillon').toLowerCase();
  if (['payée', 'envoyée'].includes(s)) return 'done';
  if (s === 'brouillon') return 'draft';
  if (s === 'annulée') return 'missing';
  return 'in_progress';
}

function financeInvoiceStepStatus(status: string): FluxStepStatus {
  const s = (status || 'draft').toLowerCase();
  if (['issued', 'partial', 'paid'].includes(s)) return 'done';
  if (s === 'draft') return 'draft';
  if (s === 'void') return 'missing';
  return 'in_progress';
}

function makeRef(
  module: FluxDocModule,
  id: string,
  numero: string,
  date?: string,
  status?: string,
  previewPayload?: unknown
): FluxStepRef {
  return { module, id, numero, date, status, previewPayload };
}

function buildStep(
  key: FluxStepKey,
  status: FluxStepStatus,
  ref?: FluxStepRef,
  hint?: string
): FluxStep {
  return {
    key,
    label: FLUX_STEP_LABELS[key],
    status,
    owner: FLUX_STEP_OWNER[key],
    ref,
    hint,
  };
}

function parseSourceRef(meta: Record<string, unknown> | null): FinanceSourceRef | null {
  const raw = meta?.source_ref;
  if (!raw || typeof raw !== 'object') return null;
  return raw as FinanceSourceRef;
}

export async function loadFluxContext(companyId: string): Promise<FluxContextData> {
  const [bcs, bls, docsRes, facturesRes, financeRes] = await Promise.all([
    queryDevisFluxRows((select) =>
      supabase
        .from('devis')
        .select(select)
        .eq('is_bc', true)
        .eq('type', 'vente')
        .order('created_at', { ascending: false })
        .limit(500)
    ) as Promise<DevisRow[]>,
    queryDevisFluxRowsLite((select) =>
      supabase
        .from('devis')
        .select(select)
        .eq('is_bl', true)
        .eq('type', 'vente')
        .order('created_at', { ascending: false })
        .limit(500)
    ) as Promise<DevisRow[]>,
    supabase
      .from('documents')
      .select('id, type, numero, status, created_at, parent_id, metadata')
      .in('type', [
        'BC_CLIENT',
        'BC_FOURNISSEUR',
        'BL_CLIENT',
        'BE',
        'BS',
        'DEVIS_FOURNISSEUR',
        'DEMANDE_ACHAT',
        'FACTURE',
      ])
      .order('created_at', { ascending: false })
      .limit(3000),
    (supabase as any)
      .from('factures')
      .select(
        'id, numero, type, status, date_creation, source_bc_id, source_bl_id, third_party_name, items, total_amount, is_ttc, notes'
      )
      .eq('type', 'vente')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('invoices')
      .select('id, numero, status, issue_date, metadata')
      .eq('company_id', companyId)
      .eq('invoice_type', 'achat')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (docsRes.error) throw new Error(docsRes.error.message);
  if (facturesRes.error) throw new Error(facturesRes.error.message);
  if (financeRes.error) throw new Error(financeRes.error.message);

  const docs = (docsRes.data ?? []) as DocRow[];
  const factures = (facturesRes.data ?? []) as FactureRow[];
  const financeInvoices = (financeRes.data ?? []) as FinanceInvoiceRow[];

  const devisById = new Map<number, DevisRow>();
  for (const bc of bcs) devisById.set(bc.id, bc);
  for (const bl of bls) devisById.set(bl.id, bl);

  const sourceDevisIds = [...new Set(bcs.map((b) => b.source_devis_id).filter((id): id is number => id != null))];
  if (sourceDevisIds.length > 0) {
    const sourceDevis = (await queryDevisFluxRows((select) =>
      supabase.from('devis').select(select).in('id', sourceDevisIds)
    )) as DevisRow[];
    for (const d of sourceDevis) devisById.set(d.id, d);
  }

  const legacyBlByBcId = new Map<number, DevisRow>();
  for (const bl of bls) {
    const bcId = resolveBcIdFromBlRow(bl);
    if (bcId != null) legacyBlByBcId.set(bcId, bl);
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

  const demandeAchatByBcDocId = new Map<string, DocRow>();
  for (const d of docs) {
    if (d.type === 'DEMANDE_ACHAT' && d.parent_id) {
      demandeAchatByBcDocId.set(d.parent_id, d);
    }
  }

  const factureByBcId = new Map<number, FactureRow>();
  const factureByBlId = new Map<number, FactureRow>();
  for (const f of factures) {
    if (f.source_bc_id != null) factureByBcId.set(f.source_bc_id, f);
    if (f.source_bl_id != null) factureByBlId.set(f.source_bl_id, f);
  }

  const financeBySourceId = new Map<string, FinanceInvoiceRow>();
  for (const inv of financeInvoices) {
    const ref = parseSourceRef(inv.metadata);
    if (ref?.source_id) financeBySourceId.set(ref.source_id, inv);
    if (ref?.grouped_source_ids?.length) {
      for (const gid of ref.grouped_source_ids) financeBySourceId.set(gid, inv);
    }
  }

  return {
    devisById,
    legacyBlByBcId,
    docs,
    factures,
    financeInvoices,
    promotedBcByLegacyId,
    bcFournisseurByVenteDevisId,
    childrenByParentId,
    factureByBcId,
    factureByBlId,
    financeBySourceId,
    demandeAchatByBcDocId,
  };
}

function resolveBcFournisseurs(ctx: FluxContextData, bc: DevisRow): DocRow[] {
  const fromMeta = ctx.bcFournisseurByVenteDevisId.get(bc.id) ?? [];
  const promotedId = ctx.promotedBcByLegacyId.get(String(bc.id));
  const fromParent = promotedId
    ? (ctx.childrenByParentId.get(promotedId) ?? []).filter((d) => d.type === 'BC_FOURNISSEUR')
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

function resolveBlVente(ctx: FluxContextData, bc: DevisRow): { doc: DocRow | null; legacy: DevisRow | null; hint?: string } {
  const legacy = ctx.legacyBlByBcId.get(bc.id) ?? null;
  const promotedId = ctx.promotedBcByLegacyId.get(String(bc.id));
  const v2Bl = promotedId
    ? (ctx.childrenByParentId.get(promotedId) ?? []).find((d) => d.type === 'BL_CLIENT') ?? null
    : null;
  if (v2Bl) return { doc: v2Bl, legacy };
  if (legacy) {
    return {
      doc: null,
      legacy,
      hint: legacy ? 'BL legacy — pas de sortie stock automatique' : undefined,
    };
  }
  return { doc: null, legacy: null };
}

function resolveBeForBcFournisseur(ctx: FluxContextData, bcFournisseur: DocRow): DocRow | null {
  const children = ctx.childrenByParentId.get(bcFournisseur.id) ?? [];
  return children.find((d) => d.type === 'BE') ?? null;
}

function resolveBsForBcClient(ctx: FluxContextData, promotedBcDocId: string | null): DocRow | null {
  if (!promotedBcDocId) return null;
  const children = ctx.childrenByParentId.get(promotedBcDocId) ?? [];
  return children.find((d) => d.type === 'BS') ?? null;
}

function resolveFinancePurchase(
  ctx: FluxContextData,
  bcFournisseur: DocRow,
  be: DocRow | null
): FinanceInvoiceRow | null {
  const direct = ctx.financeBySourceId.get(bcFournisseur.id);
  if (direct) return direct;
  if (be) {
    const fromBe = ctx.financeBySourceId.get(be.id);
    if (fromBe) return fromBe;
  }
  return null;
}

function resolveFactureClient(ctx: FluxContextData, bc: DevisRow, legacyBl: DevisRow | null): FactureRow | null {
  if (legacyBl && ctx.factureByBlId.has(legacyBl.id)) {
    return ctx.factureByBlId.get(legacyBl.id)!;
  }
  return ctx.factureByBcId.get(bc.id) ?? null;
}

function resolveV2FactureClient(ctx: FluxContextData, promotedBcDocId: string | null): DocRow | null {
  if (!promotedBcDocId) return null;
  const bl = (ctx.childrenByParentId.get(promotedBcDocId) ?? []).find((d) => d.type === 'BL_CLIENT');
  if (!bl) return null;
  const children = ctx.childrenByParentId.get(bl.id) ?? [];
  return children.find((d) => d.type === 'FACTURE') ?? null;
}

function applyCheckpoint(
  step: FluxStep,
  checkpoints: Map<FluxStepKey, DossierCheckpointRow>
): FluxStep {
  const cp = checkpoints.get(step.key);
  if (cp?.status === 'done') return { ...step, status: 'done' };
  if (cp?.status === 'skipped') return { ...step, status: 'skipped' };
  return step;
}

export function resolveFluxSteps(
  bc: DevisRow,
  ctx: FluxContextData,
  checkpoints: DossierCheckpointRow[] = []
): FluxStep[] {
  const cpMap = new Map(checkpoints.map((c) => [c.step_key as FluxStepKey, c]));
  const devisClient = bc.source_devis_id ? ctx.devisById.get(bc.source_devis_id) : undefined;
  const bcFournisseurs = resolveBcFournisseurs(ctx, bc);
  const primaryBcF = bcFournisseurs[0] ?? null;
  const be = primaryBcF ? resolveBeForBcFournisseur(ctx, primaryBcF) : null;
  const financePurchase = primaryBcF ? resolveFinancePurchase(ctx, primaryBcF, be) : null;
  const promotedId = ctx.promotedBcByLegacyId.get(String(bc.id)) ?? null;
  const { doc: blDoc, legacy: legacyBl, hint: blHint } = resolveBlVente(ctx, bc);
  const bs = resolveBsForBcClient(ctx, promotedId);
  const factureLegacy = resolveFactureClient(ctx, bc, legacyBl);
  const factureV2 = resolveV2FactureClient(ctx, promotedId);
  const demandeAchat = promotedId ? ctx.demandeAchatByBcDocId.get(promotedId) : undefined;
  const devisFournisseur = promotedId
    ? (ctx.childrenByParentId.get(promotedId) ?? []).find((d) => d.type === 'DEVIS_FOURNISSEUR')
    : undefined;

  let stepConfirmation: FluxStep;
  if (devisClient && ['accepté', 'confirmé'].includes(devisClient.status.toLowerCase())) {
    stepConfirmation = buildStep(
      'confirmation',
      'done',
      makeRef('devis', String(devisClient.id), devisClient.devis_number, devisClient.devis_date, devisClient.status, devisClient)
    );
  } else if (devisClient) {
    stepConfirmation = buildStep('confirmation', devisStepStatus(devisClient.status));
  } else {
    stepConfirmation = buildStep('confirmation', 'missing');
  }

  const stepDevisClient = devisClient
    ? buildStep(
        'devis_client',
        devisStepStatus(devisClient.status),
        makeRef('devis', String(devisClient.id), devisClient.devis_number, devisClient.devis_date, devisClient.status, devisClient)
      )
    : buildStep('devis_client', 'skipped', undefined, 'Pas de devis source');

  const stepBcClient = buildStep(
    'bc_client',
    devisStepStatus(bc.status),
    makeRef('devis', String(bc.id), bc.devis_number, bc.devis_date, bc.status, bc)
  );

  let stepAchatDemande: FluxStep;
  if (demandeAchat) {
    stepAchatDemande = buildStep(
      'achat_demande',
      documentStepStatus(demandeAchat.type, demandeAchat.status),
      makeRef('documents', demandeAchat.id, demandeAchat.numero, demandeAchat.created_at.slice(0, 10), demandeAchat.status, demandeAchat)
    );
  } else if (primaryBcF) {
    stepAchatDemande = buildStep('achat_demande', 'skipped', undefined, 'Achats lancés sans demande formelle');
  } else {
    stepAchatDemande = buildStep('achat_demande', 'missing');
  }

  let stepDevisFournisseur: FluxStep;
  if (devisFournisseur) {
    stepDevisFournisseur = buildStep(
      'devis_fournisseur',
      documentStepStatus(devisFournisseur.type, devisFournisseur.status),
      makeRef('documents', devisFournisseur.id, devisFournisseur.numero, devisFournisseur.created_at.slice(0, 10), devisFournisseur.status, devisFournisseur)
    );
  } else if (primaryBcF) {
    stepDevisFournisseur = buildStep('devis_fournisseur', 'skipped', undefined, 'BC fournisseur direct');
  } else {
    stepDevisFournisseur = buildStep('devis_fournisseur', 'missing');
  }

  const stepBcFournisseur = primaryBcF
    ? buildStep(
        'bc_fournisseur',
        documentStepStatus(primaryBcF.type, primaryBcF.status),
        makeRef('documents', primaryBcF.id, primaryBcF.numero, primaryBcF.created_at.slice(0, 10), primaryBcF.status, primaryBcF),
        bcFournisseurs.length > 1 ? `${bcFournisseurs.length} BC fournisseur(s)` : undefined
      )
    : buildStep('bc_fournisseur', 'missing');

  const stepReception = be
    ? buildStep(
        'reception_stock',
        documentStepStatus(be.type, be.status),
        makeRef('documents', be.id, be.numero, be.created_at.slice(0, 10), be.status, be)
      )
    : primaryBcF
      ? buildStep('reception_stock', 'missing', undefined, 'Réception magasin (BE) en attente')
      : buildStep('reception_stock', 'missing');

  let stepFactureFournisseur: FluxStep;
  if (financePurchase) {
    stepFactureFournisseur = buildStep(
      'facture_fournisseur',
      financeInvoiceStepStatus(financePurchase.status),
      makeRef('finance', financePurchase.id, financePurchase.numero, financePurchase.issue_date, financePurchase.status, financePurchase)
    );
  } else if (be && documentStepStatus(be.type, be.status) === 'done') {
    stepFactureFournisseur = buildStep(
      'facture_fournisseur',
      'in_progress',
      makeRef('documents', be.id, be.numero, be.created_at.slice(0, 10), be.status, be),
      'BE validé — facture Finance non liée'
    );
  } else {
    stepFactureFournisseur = buildStep('facture_fournisseur', 'missing');
  }

  let stepPreparation: FluxStep;
  if (bs) {
    stepPreparation = buildStep(
      'preparation',
      documentStepStatus(bs.type, bs.status) === 'done' ? 'done' : 'in_progress',
      makeRef('documents', bs.id, bs.numero, bs.created_at.slice(0, 10), bs.status, bs)
    );
  } else {
    stepPreparation = buildStep('preparation', 'missing');
  }

  const stepSortieStock = bs
    ? buildStep(
        'sortie_stock',
        documentStepStatus(bs.type, bs.status),
        makeRef('documents', bs.id, bs.numero, bs.created_at.slice(0, 10), bs.status, bs)
      )
    : buildStep('sortie_stock', 'missing');

  let stepBl: FluxStep;
  if (blDoc) {
    stepBl = buildStep(
      'bl_vente',
      documentStepStatus(blDoc.type, blDoc.status),
      makeRef('documents', blDoc.id, blDoc.numero, blDoc.created_at.slice(0, 10), blDoc.status, blDoc)
    );
  } else if (legacyBl) {
    stepBl = buildStep(
      'bl_vente',
      devisStepStatus(legacyBl.status),
      makeRef('devis', String(legacyBl.id), legacyBl.devis_number, legacyBl.devis_date, legacyBl.status, legacyBl),
      blHint
    );
  } else {
    stepBl = buildStep('bl_vente', 'missing');
  }

  let stepLivraisonConfirmee = buildStep('livraison_confirmee', 'missing');

  let stepFactureClient: FluxStep;
  if (factureLegacy) {
    stepFactureClient = buildStep(
      'facture_client',
      factureStepStatus(factureLegacy.status),
      makeRef('factures', factureLegacy.id, factureLegacy.numero, factureLegacy.date_creation, factureLegacy.status, factureLegacy)
    );
  } else if (factureV2) {
    stepFactureClient = buildStep(
      'facture_client',
      documentStepStatus(factureV2.type, factureV2.status),
      makeRef('documents', factureV2.id, factureV2.numero, factureV2.created_at.slice(0, 10), factureV2.status, factureV2)
    );
  } else {
    stepFactureClient = buildStep('facture_client', 'missing');
  }

  const raw = [
    stepConfirmation,
    stepDevisClient,
    stepBcClient,
    stepAchatDemande,
    stepDevisFournisseur,
    stepBcFournisseur,
    stepReception,
    stepFactureFournisseur,
    stepPreparation,
    stepSortieStock,
    stepBl,
    stepLivraisonConfirmee,
    stepFactureClient,
  ];

  return raw.map((s) => applyCheckpoint(s, cpMap));
}

export function computeFluxMetrics(steps: FluxStep[]): {
  completionPercent: number;
  completedSteps: number;
  missingSteps: FluxStepKey[];
  missingDocumentLabels: string[];
  health: 'complete' | 'in_progress' | 'incomplete';
  isComplete: boolean;
  blockedAt?: FluxStepKey;
  currentStep?: FluxStepKey;
  nextActionLabel: string | null;
} {
  const countable = steps.filter((s) => s.status !== 'skipped');
  const doneCount = countable.filter((s) => s.status === 'done').length;
  const completionPercent = countable.length
    ? Math.round((doneCount / countable.length) * 100)
    : 0;

  const missingSteps = steps
    .filter((s) => FLUX_REQUIRED_STEPS.includes(s.key) && (s.status === 'missing' || s.status === 'draft'))
    .map((s) => s.key);

  const missingDocumentLabels = steps
    .filter((s) => s.status === 'missing' || (FLUX_REQUIRED_STEPS.includes(s.key) && s.status === 'draft'))
    .map((s) => FLUX_STEP_LABELS[s.key]);

  const requiredDone = FLUX_REQUIRED_STEPS.every((key) => {
    const step = steps.find((s) => s.key === key);
    return step && (step.status === 'done' || step.status === 'skipped');
  });

  const factureDone = steps.find((s) => s.key === 'facture_client')?.status === 'done';
  const isComplete = requiredDone && factureDone;

  let health: 'complete' | 'in_progress' | 'incomplete';
  if (isComplete) health = 'complete';
  else if (missingSteps.length > 0) health = 'incomplete';
  else health = 'in_progress';

  const blocked = steps.find(
    (s) => FLUX_REQUIRED_STEPS.includes(s.key) && (s.status === 'missing' || s.status === 'draft')
  );

  const nextBlocked = steps.find((s) => s.status === 'missing' || s.status === 'in_progress' || s.status === 'draft');

  let nextActionLabel: string | null = null;
  if (blocked) {
    nextActionLabel = `Manque : ${FLUX_STEP_LABELS[blocked.key]}`;
  } else if (nextBlocked && nextBlocked.status !== 'done') {
    nextActionLabel = `En attente : ${FLUX_STEP_LABELS[nextBlocked.key]}`;
  }

  return {
    completionPercent,
    completedSteps: doneCount,
    missingSteps,
    missingDocumentLabels,
    health,
    isComplete,
    blockedAt: blocked?.key,
    currentStep: nextBlocked?.key,
    nextActionLabel,
  };
}

const ACHAT_FLUX_STEPS: FluxStepKey[] = [
  'devis_fournisseur',
  'bc_fournisseur',
  'reception_stock',
  'facture_fournisseur',
];

function resolveAchatFluxDetail(
  dossier: CommercialDossierRow,
  checkpoints: DossierCheckpointRow[] = []
): FluxDossierDetail {
  const checkpointDone = new Set(
    checkpoints.filter((c) => c.status === 'done').map((c) => c.step_key)
  );

  const steps: FluxStep[] = ACHAT_FLUX_STEPS.map((key) => {
    let status: FluxStepStatus = 'missing';
    if (checkpointDone.has(key)) {
      status = 'done';
    } else if (key === 'devis_fournisseur' && (dossier.anchor_devis_id || dossier.devis_reference)) {
      status = 'done';
    } else if (dossier.missing_steps && !dossier.missing_steps.includes(key)) {
      status = 'done';
    }

    const ref =
      key === 'devis_fournisseur' && dossier.devis_reference
        ? makeRef('devis', String(dossier.anchor_devis_id ?? ''), dossier.devis_reference)
        : undefined;

    return buildStep(key, status, ref);
  });

  const metrics = computeFluxMetrics(steps);

  return {
    ...dossier,
    steps,
    ...metrics,
    totalSteps: steps.length,
    nextActionLabel: dossier.next_action_label ?? metrics.nextActionLabel,
  };
}

export function resolveFluxDetail(
  dossier: CommercialDossierRow,
  ctx: FluxContextData,
  checkpoints: DossierCheckpointRow[] = []
): FluxDossierDetail | null {
  if (dossier.direction === 'achat') {
    return resolveAchatFluxDetail(dossier, checkpoints);
  }

  let bcId = dossier.anchor_bc_devis_id;
  let bc = bcId != null ? ctx.devisById.get(bcId) : undefined;

  if (!bc && dossier.anchor_devis_id) {
    const linkedBc = [...ctx.devisById.values()].find(
      (d) => d.is_bc && d.source_devis_id === dossier.anchor_devis_id
    );
    if (linkedBc) {
      bc = linkedBc;
      bcId = linkedBc.id;
    } else {
      const devis = ctx.devisById.get(dossier.anchor_devis_id);
      if (devis) {
        const pseudoBc = { ...devis, is_bc: false };
        const steps = resolveFluxSteps(pseudoBc, ctx, checkpoints);
        const metrics = computeFluxMetrics(steps);
        return {
          ...dossier,
          steps,
          ...metrics,
          totalSteps: steps.filter((s) => s.status !== 'skipped').length,
        };
      }
    }
  }

  if (!bc || bcId == null) return null;

  const steps = resolveFluxSteps(bc, ctx, checkpoints);
  const metrics = computeFluxMetrics(steps);

  return {
    ...dossier,
    steps,
    ...metrics,
    totalSteps: steps.filter((s) => s.status !== 'skipped').length,
  };
}

export function missingStepChips(missingSteps: FluxStepKey[]): string[] {
  return missingSteps.map((k) => FLUX_STEP_SHORT_CHIP[k]);
}

export type FluxListFilter = FluxListTab | 'all';

export function filterDossiersByTab(
  dossiers: FluxDossierDetail[],
  tab: FluxListFilter
): FluxDossierDetail[] {
  if (tab === 'all') return dossiers;
  if (tab === 'termines') return dossiers.filter((d) => d.isComplete || d.health === 'complete');
  if (tab === 'incomplets') return dossiers.filter((d) => d.health === 'incomplete');
  return dossiers.filter((d) => !d.isComplete && d.health !== 'complete' && d.health !== 'incomplete');
}

export function filterDossiersBySearch(dossiers: FluxDossierDetail[], query: string): FluxDossierDetail[] {
  const q = query.trim().toLowerCase();
  if (!q) return dossiers;
  return dossiers.filter(
    (d) =>
      (d.client_name?.toLowerCase().includes(q) ?? false) ||
      (d.fournisseur_name?.toLowerCase().includes(q) ?? false) ||
      d.dossier_number.toLowerCase().includes(q) ||
      (d.bc_reference?.toLowerCase().includes(q) ?? false) ||
      (d.devis_reference?.toLowerCase().includes(q) ?? false)
  );
}

export { FLUX_STEP_ORDER };

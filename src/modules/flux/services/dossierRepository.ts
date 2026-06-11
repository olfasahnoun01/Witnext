import { supabase } from '@/integrations/supabase/client';
import type {
  AssignedRole,
  CommercialDossierRow,
  DossierCheckpointRow,
  DossierEventRow,
  FluxStepKey,
} from '../types/dossierTypes';
import {
  computeFluxMetrics,
  loadFluxContext,
  resolveFluxDetail,
  resolveFluxSteps,
} from './fluxResolver';
import { resolveBcIdFromBlRow } from './devisFluxFields';

export async function generateDossierNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FLX-${year}-`;
  const { data, error } = await supabase
    .from('commercial_dossiers')
    .select('dossier_number')
    .eq('company_id', companyId)
    .like('dossier_number', `${prefix}%`)
    .order('dossier_number', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  let next = 1;
  if (data?.[0]?.dossier_number) {
    const tail = data[0].dossier_number.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export async function fetchDossiers(companyId: string): Promise<CommercialDossierRow[]> {
  const { data, error } = await supabase
    .from('commercial_dossiers')
    .select('*')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as CommercialDossierRow[];
}

export async function fetchDossierById(dossierId: string): Promise<CommercialDossierRow | null> {
  const { data, error } = await supabase
    .from('commercial_dossiers')
    .select('*')
    .eq('id', dossierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CommercialDossierRow) ?? null;
}

export async function fetchDossierEvents(dossierId: string): Promise<DossierEventRow[]> {
  const { data, error } = await supabase
    .from('commercial_dossier_events')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as DossierEventRow[];
}

export async function fetchDossierCheckpoints(dossierId: string): Promise<DossierCheckpointRow[]> {
  const { data, error } = await supabase
    .from('commercial_dossier_checkpoints')
    .select('*')
    .eq('dossier_id', dossierId);
  if (error) throw new Error(error.message);
  return (data ?? []) as DossierCheckpointRow[];
}

export async function appendDossierEvent(
  dossierId: string,
  event: {
    event_type: DossierEventRow['event_type'];
    message: string;
    step_key?: FluxStepKey;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('commercial_dossier_events').insert({
    dossier_id: dossierId,
    event_type: event.event_type,
    message: event.message,
    step_key: event.step_key ?? null,
    payload: event.payload ?? {},
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function upsertCheckpoint(
  dossierId: string,
  stepKey: FluxStepKey,
  notes?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('commercial_dossier_checkpoints').upsert(
    {
      dossier_id: dossierId,
      step_key: stepKey,
      status: 'done',
      completed_by: user?.id ?? null,
      notes: notes ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'dossier_id,step_key' }
  );
  if (error) throw new Error(error.message);
}

export async function syncDossierMetrics(dossierId: string, companyId: string): Promise<void> {
  const dossier = await fetchDossierById(dossierId);
  if (!dossier) return;

  const [ctx, checkpoints] = await Promise.all([
    loadFluxContext(companyId),
    fetchDossierCheckpoints(dossierId),
  ]);
  const detail = resolveFluxDetail(dossier, ctx, checkpoints);
  if (!detail) return;

  const status = detail.isComplete ? 'completed' : dossier.status === 'cancelled' ? 'cancelled' : 'active';

  const { error } = await supabase
    .from('commercial_dossiers')
    .update({
      health: detail.health,
      missing_steps: detail.missingSteps,
      completion_percent: detail.completionPercent,
      next_action_label: detail.nextActionLabel,
      current_step: detail.currentStep ?? null,
      status,
    })
    .eq('id', dossierId);

  if (error) throw new Error(error.message);
}

export interface CreateDossierInput {
  companyId: string;
  anchorBcDevisId: number;
  clientName?: string | null;
  clientId?: number | null;
  devisReference?: string | null;
  bcReference?: string | null;
  anchorDevisId?: number | null;
  anchorDocumentId?: string | null;
}

export interface StartFluxInput {
  companyId: string;
  direction: import('./fluxClientDocuments').FluxDirection;
  partyName: string;
  clientId?: number | null;
  fournisseurId?: number | null;
  document: import('./fluxClientDocuments').FluxDocumentOption;
}

export async function findDossierByAnchor(
  companyId: string,
  anchorBcDevisId: number | null,
  anchorDevisId: number | null
): Promise<CommercialDossierRow | null> {
  if (anchorBcDevisId != null) {
    return findDossierByBcDevisId(companyId, anchorBcDevisId);
  }
  if (anchorDevisId != null) {
    const { data, error } = await supabase
      .from('commercial_dossiers')
      .select('*')
      .eq('company_id', companyId)
      .eq('anchor_devis_id', anchorDevisId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as CommercialDossierRow) ?? null;
  }
  return null;
}

export async function startFluxDossier(input: StartFluxInput): Promise<CommercialDossierRow> {
  const { companyId, direction, partyName, clientId, fournisseurId, document: doc } = input;

  if (direction === 'vente' && doc.anchorBcDevisId != null) {
    const existing = await findDossierByAnchor(companyId, doc.anchorBcDevisId, doc.anchorDevisId);
    if (existing) {
      await syncDossierMetrics(existing.id, companyId);
      return existing;
    }
    return createDossierForBc({
      companyId,
      anchorBcDevisId: doc.anchorBcDevisId,
      clientName: partyName,
      clientId: clientId ?? null,
      anchorDevisId: doc.anchorDevisId,
      bcReference: doc.kind === 'bc' || doc.kind === 'bc_client' ? doc.numero : undefined,
      devisReference: doc.kind === 'devis' ? doc.numero : undefined,
      anchorDocumentId: doc.anchorDocumentId,
    });
  }

  if (direction === 'vente') {
    const existing = await findDossierByAnchor(companyId, doc.anchorBcDevisId, doc.anchorDevisId);
    if (existing) {
      await syncDossierMetrics(existing.id, companyId);
      return existing;
    }

    const ctx = await loadFluxContext(companyId);
    let anchorDevisId = doc.anchorDevisId;
    if (!anchorDevisId && doc.kind === 'devis') {
      anchorDevisId = parseInt(doc.id, 10);
    }

    if (doc.kind === 'bl') {
      const bl = ctx.devisById.get(parseInt(doc.id, 10));
      const anchorBc = bl ? resolveBcIdFromBlRow(bl) : doc.anchorBcDevisId;
      if (anchorBc != null) {
        return createDossierForBc({
          companyId,
          anchorBcDevisId: anchorBc,
          clientName: partyName,
          clientId: clientId ?? null,
          anchorDevisId: bl?.source_devis_id ?? doc.anchorDevisId,
          anchorDocumentId: doc.anchorDocumentId,
        });
      }
    }

    const devisRow = anchorDevisId ? ctx.devisById.get(anchorDevisId) : null;
    const steps = devisRow
      ? resolveFluxSteps(
          {
            ...devisRow,
            is_bc: false,
            id: devisRow.id,
          } as Parameters<typeof resolveFluxSteps>[0],
          ctx
        )
      : [];
    const metrics = steps.length
      ? computeFluxMetrics(steps)
      : {
          health: 'in_progress' as const,
          missingSteps: [] as FluxStepKey[],
          completionPercent: 0,
          nextActionLabel: 'Sélectionner ou créer un BC client',
          currentStep: 'bc_client' as FluxStepKey,
          blockedAt: 'bc_client' as FluxStepKey,
        };

    const dossierNumber = await generateDossierNumber(companyId);
    const { data: { user } } = await supabase.auth.getUser();

    const bcRef = doc.kind === 'bc' || doc.kind === 'bc_client' ? doc.numero : null;
    const devisRef = doc.kind === 'devis' ? doc.numero : null;

    const { data, error } = await supabase
      .from('commercial_dossiers')
      .insert({
        company_id: companyId,
        dossier_number: dossierNumber,
        direction: 'vente',
        status: 'active',
        client_id: clientId ?? null,
        client_name: partyName,
        anchor_bc_devis_id: null,
        anchor_devis_id: anchorDevisId,
        anchor_document_id: doc.anchorDocumentId,
        bc_reference: bcRef,
        devis_reference: devisRef ?? devisRow?.devis_number ?? null,
        health: metrics.health ?? 'in_progress',
        missing_steps: metrics.missingSteps ?? ['bc_client'],
        completion_percent: metrics.completionPercent ?? 0,
        next_action_label: metrics.nextActionLabel ?? 'Créer un BC client',
        current_step: metrics.currentStep ?? 'bc_client',
        assigned_role: 'commercial',
        created_by: user?.id ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    const row = data as CommercialDossierRow;
    await appendDossierEvent(row.id, {
      event_type: 'action',
      message: `Flux démarré manuellement — ${doc.label} ${doc.numero}`,
      payload: { document_kind: doc.kind, document_id: doc.id },
    });

    if (anchorDevisId) {
      await syncDossierMetrics(row.id, companyId);
    }

    return row;
  }

  // Achat / fournisseur — dossier lié au fournisseur et à la pièce achat
  let anchorDevisId = doc.anchorDevisId;
  if (!anchorDevisId && (doc.kind === 'devis' || doc.kind === 'ba')) {
    anchorDevisId = parseInt(doc.id, 10);
  }

  const dossierNumber = await generateDossierNumber(companyId);
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('commercial_dossiers')
    .insert({
      company_id: companyId,
      dossier_number: dossierNumber,
      direction: 'achat',
      status: 'active',
      fournisseur_id: fournisseurId ?? null,
      fournisseur_name: partyName,
      anchor_devis_id: anchorDevisId,
      anchor_document_id: doc.anchorDocumentId,
      devis_reference: doc.kind === 'devis' || doc.kind === 'devis_fournisseur' ? doc.numero : null,
      health: 'in_progress',
      missing_steps: ['devis_fournisseur'],
      completion_percent: 0,
      next_action_label: 'Suivi achat fournisseur en cours',
      current_step: 'devis_fournisseur',
      assigned_role: 'achats',
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const row = data as CommercialDossierRow;
  await appendDossierEvent(row.id, {
    event_type: 'action',
    message: `Flux achat démarré — ${doc.label} ${doc.numero}`,
    payload: { document_kind: doc.kind, document_id: doc.id, fournisseur: partyName },
  });

  return row;
}

export async function findDossierByBcDevisId(
  companyId: string,
  bcDevisId: number
): Promise<CommercialDossierRow | null> {
  const { data, error } = await supabase
    .from('commercial_dossiers')
    .select('*')
    .eq('company_id', companyId)
    .eq('anchor_bc_devis_id', bcDevisId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CommercialDossierRow) ?? null;
}

export async function createDossierForBc(input: CreateDossierInput): Promise<CommercialDossierRow> {
  const existing = await findDossierByBcDevisId(input.companyId, input.anchorBcDevisId);
  if (existing) {
    await syncDossierMetrics(existing.id, input.companyId);
    return existing;
  }

  const ctx = await loadFluxContext(input.companyId);
  const bc = ctx.devisById.get(input.anchorBcDevisId);
  if (!bc) throw new Error('BC introuvable pour créer le dossier');

  const steps = resolveFluxSteps(bc, ctx);
  const metrics = computeFluxMetrics(steps);
  const dossierNumber = await generateDossierNumber(input.companyId);
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('commercial_dossiers')
    .insert({
      company_id: input.companyId,
      dossier_number: dossierNumber,
      direction: 'vente',
      status: 'active',
      client_id: input.clientId ?? null,
      client_name: input.clientName ?? bc.third_party_name,
      anchor_bc_devis_id: input.anchorBcDevisId,
      anchor_devis_id: input.anchorDevisId ?? bc.source_devis_id,
      anchor_document_id: input.anchorDocumentId ?? null,
      bc_reference: input.bcReference ?? bc.devis_number,
      devis_reference: input.devisReference ?? null,
      health: metrics.health,
      missing_steps: metrics.missingSteps,
      completion_percent: metrics.completionPercent,
      next_action_label: metrics.nextActionLabel,
      current_step: metrics.currentStep ?? null,
      assigned_role: metrics.blockedAt ? undefined : 'commercial',
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const row = data as CommercialDossierRow;
  await appendDossierEvent(row.id, {
    event_type: 'action',
    message: `Dossier créé — ${dossierNumber}`,
    payload: { bc_id: input.anchorBcDevisId },
  });

  return row;
}

export async function assignDossier(
  dossierId: string,
  userId: string | null,
  role: AssignedRole | null
): Promise<void> {
  const { error } = await supabase
    .from('commercial_dossiers')
    .update({ assigned_user_id: userId, assigned_role: role })
    .eq('id', dossierId);
  if (error) throw new Error(error.message);

  await appendDossierEvent(dossierId, {
    event_type: 'assignment',
    message: userId ? `Dossier assigné (${role ?? '—'})` : 'Assignation retirée',
    payload: { user_id: userId, role },
  });
}

export async function addDossierNote(dossierId: string, message: string): Promise<void> {
  await appendDossierEvent(dossierId, {
    event_type: 'note',
    message,
  });
}

export async function backfillDossiers(companyId: string, days = 365): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  let created = 0;

  const { data: bcs, error: bcError } = await supabase
    .from('devis')
    .select('id, devis_number, third_party_name, source_devis_id, created_at')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .eq('is_bc', true)
    .eq('type', 'vente')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (bcError) throw new Error(bcError.message);

  for (const bc of bcs ?? []) {
    const exists = await findDossierByBcDevisId(companyId, bc.id);
    if (exists) continue;
    await createDossierForBc({
      companyId,
      anchorBcDevisId: bc.id,
      clientName: bc.third_party_name,
      anchorDevisId: bc.source_devis_id,
      bcReference: bc.devis_number,
    });
    created++;
  }

  const { data: devisOnly, error: devisError } = await supabase
    .from('devis')
    .select('id, devis_number, third_party_name, created_at')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .eq('type', 'vente')
    .eq('is_bc', false)
    .eq('is_bl', false)
    .eq('is_ba', false)
    .not('third_party_name', 'is', null)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(500);

  if (devisError) throw new Error(devisError.message);

  for (const d of devisOnly ?? []) {
    const byDevis = await findDossierByAnchor(companyId, null, d.id);
    if (byDevis) continue;
    const linkedBc = (bcs ?? []).find((bc) => bc.source_devis_id === d.id);
    if (linkedBc) continue;

    const dossierNumber = await generateDossierNumber(companyId);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('commercial_dossiers').insert({
      company_id: companyId,
      dossier_number: dossierNumber,
      direction: 'vente',
      status: 'active',
      client_name: d.third_party_name,
      anchor_devis_id: d.id,
      devis_reference: d.devis_number,
      health: 'in_progress',
      missing_steps: ['bc_client'],
      completion_percent: 0,
      next_action_label: 'Créer un BC client',
      current_step: 'bc_client',
      assigned_role: 'commercial',
      created_by: user?.id ?? null,
    });
    if (!error) created++;
  }

  return created;
}

export async function loadDossierDetails(companyId: string) {
  const [dossiers, ctx] = await Promise.all([fetchDossiers(companyId), loadFluxContext(companyId)]);

  const details = await Promise.all(
    dossiers.map(async (d) => {
      const checkpoints = await fetchDossierCheckpoints(d.id);
      return resolveFluxDetail(d, ctx, checkpoints);
    })
  );

  return details.filter((d): d is NonNullable<typeof d> => d != null);
}

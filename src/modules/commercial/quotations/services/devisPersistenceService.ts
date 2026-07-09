import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId, requireActiveCompanyId } from '@/lib/activeCompany';
import {
  parseAttachmentUrls,
  uploadCommercialAttachments,
  type CommercialAttachmentRecord,
} from '@/lib/commercialAttachments';
import { computeDevisTotals, prepareDevisItemsForPersistence, resolveFodecEnabled } from '@/lib/devisPricing';
import { allocateDevisNumber } from '@/lib/devisNumbering';
import { buildMergedBcNotes } from '@/lib/mergeCommercialDocuments';
import { ensureSuiviFromDevis } from '@/lib/partiesSuivi';
import { resolveDevisPartyTvaPersistence } from '@/lib/devisTvaPolicy';
import { formatAppDateTime } from '@/lib/formatAppDate';
import {
  ensureSupabaseSessionReady,
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import { documentService } from '@/modules/commercial/services/documentService';
import { createDossierForBc } from '@/modules/flux/services/dossierRepository';
import { notifyDossierCreated } from '@/modules/flux/services/dossierNotifications';
import type {
  CreateBcFromSourcesInput,
  CreateBcFromSourcesResult,
  PersistDevisUpdateInput,
  PersistDevisUpdateResult,
  PersistNewDevisInput,
  PersistNewDevisResult,
} from '@/modules/commercial/quotations/types/devisPersistenceTypes';
import { insertDevisRecord, patchDevisAttachments } from './devisRepository';

function cloneItems<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items)) as T[];
}

export async function persistNewDevis(input: PersistNewDevisInput): Promise<PersistNewDevisResult> {
  const partyTva = await resolveDevisPartyTvaPersistence({
    devisType: input.devisType,
    thirdPartyName: input.thirdPartyName,
    thirdPartyTaxId: input.thirdPartyTaxId,
    items: input.commit?.items ?? input.devisItems,
    isTtc: input.commit?.isTtc ?? input.isTtc,
    partyTvaStatus: input.commit?.partyTvaStatus,
  });

  const totals = computeDevisTotals(partyTva.items, false, {
    devisType: input.devisType,
    docType: input.docType,
    isTvaEnabled: partyTva.isTtc,
    isFodecEnabled: input.isFodecEnabled,
  });
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = requireActiveCompanyId();
  const numberMode = input.saveAsBc ? 'bc' : 'devis';
  const persistedItems = prepareDevisItemsForPersistence(partyTva.items, {
    isFodecEnabled: input.isFodecEnabled,
    isSortantTTC: false,
  });

  const buildInsertPayload = (devisNum: string) => ({
    type: input.devisType,
    company_id: companyId,
    devis_number: devisNum,
    devis_date: input.devisDate,
    third_party_name: input.thirdPartyName || null,
    third_party_address: input.thirdPartyAddress || null,
    third_party_tax_id: input.thirdPartyTaxId || null,
    third_party_phone: input.thirdPartyPhone || null,
    items: cloneItems(persistedItems),
    total_amount: totals.totalTTC,
    notes: input.notes || null,
    created_by: user?.id,
    is_ttc: partyTva.isTtc,
    is_bc: input.saveAsBc,
    is_ba: false,
    status: input.saveAsBc ? input.documentStatus : 'brouillon',
    attachment_urls: input.existingAttachments,
    source_devis_id:
      input.saveAsBc && input.importSourceDevisIds.length > 0 ? input.importSourceDevisIds[0] : null,
    source_devis_ids:
      input.saveAsBc && input.importSourceDevisIds.length > 1 ? input.importSourceDevisIds : null,
  });

  let currentDevisNumber = input.devisNumber;
  let insertResult = await insertDevisRecord(buildInsertPayload(currentDevisNumber));

  for (let attempt = 0; insertResult.errorCode === '23505' && attempt < 3; attempt++) {
    currentDevisNumber = await allocateDevisNumber(input.devisType, numberMode);
    insertResult = await insertDevisRecord(buildInsertPayload(currentDevisNumber));
  }

  if (!insertResult.ok || !insertResult.data) {
    const isDuplicate = insertResult.errorCode === '23505';
    return {
      ok: false,
      reason: isDuplicate ? 'duplicate_number' : 'save_failed',
      message: isDuplicate
        ? 'Ce numéro de devis existe déjà. Réessayez dans un instant.'
        : 'Erreur lors de la sauvegarde',
    };
  }

  const inserted = insertResult.data;
  const docId = inserted.id as number;
  const folderKind = input.saveAsBc ? 'bc' : 'devis';
  let attachmentUrls = parseAttachmentUrls(inserted.attachment_urls);

  if (input.pendingAttachmentFiles.length > 0) {
    const uploaded = await uploadCommercialAttachments(
      input.pendingAttachmentFiles,
      `${folderKind}/${docId}`
    );
    attachmentUrls = [...attachmentUrls, ...uploaded];
    await patchDevisAttachments(docId, attachmentUrls);
  }

  if (!input.saveAsBc && (input.devisType === 'vente' || input.devisType === 'achat')) {
    await ensureSuiviFromDevis(
      {
        type: input.devisType,
        devis_number: currentDevisNumber,
        devis_date: input.devisDate,
        third_party_name: input.thirdPartyName || null,
        third_party_phone: input.thirdPartyPhone || null,
      },
      user?.id ?? null
    );
  }

  return {
    ok: true,
    devisNumber: currentDevisNumber,
    saveAsBc: input.saveAsBc,
    attachmentUrls,
    companyId,
  };
}

export async function persistDevisUpdate(input: PersistDevisUpdateInput): Promise<PersistDevisUpdateResult> {
  const ready = await ensureSupabaseSessionReady();
  if (!ready) {
    return { ok: false, reason: 'session_expired', message: 'Session expirée' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const partyTva = await resolveDevisPartyTvaPersistence({
    devisType: input.devisType,
    thirdPartyName: input.thirdPartyName,
    thirdPartyTaxId: input.thirdPartyTaxId,
    items: input.commit?.items ?? input.devisItems,
    isTtc: input.commit?.isTtc ?? input.isTtc,
    partyTvaStatus: input.commit?.partyTvaStatus,
  });
  const persistedItems = prepareDevisItemsForPersistence(partyTva.items, {
    isFodecEnabled: input.isFodecEnabled,
    isSortantTTC: false,
  });
  const totals = computeDevisTotals(persistedItems, false, {
    devisType: input.devisType,
    docType: input.docType,
    isTvaEnabled: partyTva.isTtc,
    isFodecEnabled: input.isFodecEnabled,
  });
  const folderKind = input.docType === 'bc' || input.editingDevis.is_bc ? 'bc' : 'devis';

  let attachmentUrls = input.existingAttachments;
  if (input.pendingAttachmentFiles.length > 0) {
    const uploaded = await uploadCommercialAttachments(
      input.pendingAttachmentFiles,
      `${folderKind}/${input.editingDevis.id}`
    );
    attachmentUrls = [...input.existingAttachments, ...uploaded];
  }

  const companyId = requireActiveCompanyId();
  const { data: updated, error } = await supabaseQueryWithAuthRetry(async () => {
    let q = supabase
      .from('devis')
      .update({
        type: input.devisType,
        devis_number: input.devisNumber.trim() || input.editingDevis.devis_number,
        devis_date: input.devisDate,
        third_party_name: input.thirdPartyName || null,
        third_party_address: input.thirdPartyAddress || null,
        third_party_tax_id: input.thirdPartyTaxId || null,
        third_party_phone: input.thirdPartyPhone || null,
        items: cloneItems(persistedItems),
        total_amount: totals.totalTTC,
        notes: input.notes || null,
        is_ttc: partyTva.isTtc,
        is_bc: input.editingDevis.is_bc && !input.editingDevis.is_bl,
        is_bl: input.editingDevis.is_bl ?? false,
        is_ba: input.editingDevis.is_ba ?? false,
        status: input.docType === 'bc' ? input.documentStatus : input.editingDevis.status,
        attachment_urls: attachmentUrls,
        updated_by: user?.id ?? null,
      } as never)
      .eq('id', input.editingDevis.id);
    q = filterByCompanyId(q, companyId);
    return q.select('id').maybeSingle();
  });

  if (error) {
    return { ok: false, reason: 'update_failed', message: error.message };
  }
  if (!updated) {
    return {
      ok: false,
      reason: 'update_failed',
      message: 'Aucune ligne mise à jour (droits insuffisants ou document introuvable).',
    };
  }

  return { ok: true, attachmentUrls };
}

export async function createBcFromDevisSources(
  input: CreateBcFromSourcesInput
): Promise<CreateBcFromSourcesResult> {
  if (input.sources.length === 0) {
    return { ok: false, message: 'Aucun devis source' };
  }

  const sources = input.sources;
  const primary = sources[0];
  const isMerge = sources.length > 1;
  const primaryIsTtc = primary.is_ttc ?? false;

  const bcNumber = await allocateDevisNumber(primary.type as 'achat' | 'vente', 'bc');
  const { data: { user } } = await supabase.auth.getUser();
  const partyTva = await resolveDevisPartyTvaPersistence({
    devisType: primary.type as 'achat' | 'vente',
    thirdPartyName: primary.third_party_name,
    thirdPartyTaxId: primary.third_party_tax_id,
    items: input.modifiedItems,
    isTtc: primaryIsTtc,
  });
  const fodecEnabled = resolveFodecEnabled({
    devisType: primary.type as 'achat' | 'vente',
    items: partyTva.items,
  });
  const persistedItems = prepareDevisItemsForPersistence(partyTva.items, {
    isFodecEnabled: fodecEnabled,
    isSortantTTC: false,
  });
  const totals = computeDevisTotals(persistedItems, false, {
    devisType: primary.type as 'achat' | 'vente',
    docType: 'bc',
    isTvaEnabled: partyTva.isTtc,
    isFodecEnabled: fodecEnabled,
  });
  const mergedAttachments = sources.flatMap((d) => parseAttachmentUrls(d.attachment_urls));

  const insertResult = await insertDevisRecord({
    devis_number: bcNumber,
    company_id: requireActiveCompanyId(),
    devis_date: new Date().toISOString().split('T')[0],
    source_devis_id: primary.id,
    source_devis_ids: isMerge ? sources.map((d) => d.id) : null,
    type: primary.type as 'achat' | 'vente',
    third_party_name: primary.third_party_name,
    third_party_address: primary.third_party_address,
    third_party_tax_id: primary.third_party_tax_id,
    third_party_phone: primary.third_party_phone,
    items: cloneItems(persistedItems),
    total_amount: totals.totalTTC,
    notes: isMerge ? buildMergedBcNotes(sources) : primary.notes,
    is_ttc: partyTva.isTtc,
    is_bc: true,
    created_by: user?.id,
    status: input.bcStatus,
    attachment_urls: mergedAttachments,
  });

  if (!insertResult.ok || !insertResult.data) {
    return { ok: false, message: 'Erreur lors de la création du BC' };
  }

  const insertedBcId = insertResult.data.id as number;
  const stamp = formatAppDateTime(new Date());
  for (const src of sources) {
    await documentService.appendLegacyDevisNote(
      src.id,
      `[${stamp}] BC client créé : ${bcNumber} (le devis reste dans la liste).`
    );
  }

  const companyId = getActiveCompanyId();
  if (companyId && primary.type === 'vente') {
    try {
      const dossier = await createDossierForBc({
        companyId,
        anchorBcDevisId: insertedBcId,
        clientName: primary.third_party_name,
        anchorDevisId: primary.id,
        bcReference: bcNumber,
        devisReference: primary.devis_number,
      });
      await notifyDossierCreated(dossier.id, companyId);
    } catch (dossierErr) {
      console.warn('[flux] dossier creation:', dossierErr);
    }
  }

  return { ok: true, bcNumber, insertedBcId };
}

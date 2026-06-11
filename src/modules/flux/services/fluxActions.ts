import { documentService } from '@/services/documentService';
import type { FluxStepKey } from '../types/dossierTypes';
import {
  addDossierNote,
  appendDossierEvent,
  syncDossierMetrics,
  upsertCheckpoint,
} from './dossierRepository';
import { notifyDossierStepChange } from './dossierNotifications';

export async function markCheckpointDone(
  dossierId: string,
  companyId: string,
  stepKey: FluxStepKey,
  notes?: string
): Promise<void> {
  await upsertCheckpoint(dossierId, stepKey, notes);
  await appendDossierEvent(dossierId, {
    event_type: 'step_change',
    step_key: stepKey,
    message: `Étape validée : ${stepKey}`,
    payload: { notes },
  });
  await syncDossierMetrics(dossierId, companyId);
  await notifyDossierStepChange(dossierId, companyId, stepKey);
}

export async function confirmClientReceived(
  dossierId: string,
  companyId: string,
  notes?: string
): Promise<void> {
  await markCheckpointDone(dossierId, companyId, 'livraison_confirmee', notes ?? 'Client a reçu la livraison');
}

export async function confirmPreparationDone(
  dossierId: string,
  companyId: string,
  notes?: string
): Promise<void> {
  await markCheckpointDone(dossierId, companyId, 'preparation', notes ?? 'Préparation terminée');
}

export async function confirmClientOrder(
  dossierId: string,
  companyId: string,
  notes?: string
): Promise<void> {
  await markCheckpointDone(dossierId, companyId, 'confirmation', notes ?? 'Commande confirmée par le client');
}

export async function validateBeDocument(
  dossierId: string,
  companyId: string,
  documentId: string
): Promise<void> {
  await documentService.validateBE(documentId);
  await appendDossierEvent(dossierId, {
    event_type: 'action',
    step_key: 'reception_stock',
    message: 'Bon d\'entrée stock validé',
    payload: { document_id: documentId },
  });
  await syncDossierMetrics(dossierId, companyId);
  await notifyDossierStepChange(dossierId, companyId, 'reception_stock');
}

export async function validateBsDocument(
  dossierId: string,
  companyId: string,
  documentId: string
): Promise<void> {
  await documentService.validateBS(documentId);
  await appendDossierEvent(dossierId, {
    event_type: 'action',
    step_key: 'sortie_stock',
    message: 'Bon de sortie stock validé',
    payload: { document_id: documentId },
  });
  await syncDossierMetrics(dossierId, companyId);
  await notifyDossierStepChange(dossierId, companyId, 'sortie_stock');
}

export { addDossierNote };

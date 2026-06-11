import { resolveUserIdsWithSectionAccess } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';
import { FLUX_STEP_LABELS } from '../types/dossierTypes';
import type { FluxStepKey } from '../types/dossierTypes';
import { fetchDossierById } from './dossierRepository';

async function dispatchToUsers(
  recipientIds: string[],
  payload: {
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return;

  await supabase.rpc('dispatch_notifications', {
    p_recipient_user_ids: unique,
    p_type: 'flux_dossier',
    p_title: payload.title,
    p_body: payload.body ?? null,
    p_link_tab: 'flux-suivi',
    p_entity_type: 'commercial_dossier',
    p_entity_id: (payload.metadata?.dossier_id as string) ?? null,
    p_metadata: payload.metadata ?? {},
  });
}

export async function notifyDossierStepChange(
  dossierId: string,
  companyId: string,
  stepKey: FluxStepKey
): Promise<void> {
  const dossier = await fetchDossierById(dossierId);
  if (!dossier) return;

  const label = FLUX_STEP_LABELS[stepKey];
  const title = `Suivi flux — ${dossier.dossier_number}`;
  const body = `${dossier.client_name ?? 'Client'} : ${label}`;

  if (dossier.assigned_user_id) {
    await dispatchToUsers([dossier.assigned_user_id], {
      title,
      body,
      metadata: { dossier_id: dossierId, step_key: stepKey, company_id: companyId },
    });
    return;
  }

  const sectionByRole: Record<string, string> = {
    commercial: 'ventes',
    achats: 'achats',
    magasin: 'magasin',
    finance: 'finance',
  };
  const section = dossier.assigned_role ? sectionByRole[dossier.assigned_role] : 'ventes';
  const userIds = await resolveUserIdsWithSectionAccess(section);
  await dispatchToUsers(userIds, {
    title,
    body,
    metadata: { dossier_id: dossierId, step_key: stepKey, company_id: companyId },
  });
}

export async function notifyDossierCreated(dossierId: string, companyId: string): Promise<void> {
  const dossier = await fetchDossierById(dossierId);
  if (!dossier) return;

  const userIds = await resolveUserIdsWithSectionAccess('commercial');
  await dispatchToUsers(userIds, {
    title: `Nouveau dossier — ${dossier.dossier_number}`,
    body: `${dossier.client_name ?? 'Client'} : suivi démarré`,
    metadata: { dossier_id: dossierId, company_id: companyId },
  });
}

export async function searchClientsAndFournisseurs(
  companyId: string,
  query: string
): Promise<{ id: number; nom: string; kind: 'client' | 'fournisseur' }[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [clientsRes, fournisseursRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom')
      .eq('company_id', companyId)
      .ilike('nom', `%${q}%`)
      .limit(8),
    supabase
      .from('fournisseurs')
      .select('id, nom')
      .eq('company_id', companyId)
      .ilike('nom', `%${q}%`)
      .limit(8),
  ]);

  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id as number,
    nom: c.nom as string,
    kind: 'client' as const,
  }));
  const fournisseurs = (fournisseursRes.data ?? []).map((f) => ({
    id: f.id as number,
    nom: f.nom as string,
    kind: 'fournisseur' as const,
  }));

  return [...clients, ...fournisseurs];
}

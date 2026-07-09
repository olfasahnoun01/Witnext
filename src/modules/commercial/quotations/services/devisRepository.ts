import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import type { Devis } from '@/types';

export async function deleteDevisRecord(devisId: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('devis').delete().eq('id', devisId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function deleteSuccessMessage(devis: Devis): string {
  if (devis.is_bl) return 'Bon de livraison supprimé';
  if (devis.is_bc) return 'Bon de commande supprimé';
  return 'Devis supprimé';
}

export async function confirmDevisRecord(
  devisId: number,
  userId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('devis')
    .update({
      status: 'confirmé',
      updated_by: userId,
    } as never)
    .eq('id', devisId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateDevisRecord(
  devisId: number,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; updatedId?: number }> {
  const companyId = requireActiveCompanyId();
  const { data, error } = await supabase
    .from('devis')
    .update(payload as never)
    .eq('id', devisId)
    .eq('company_id', companyId)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: 'Aucune ligne mise à jour (droits insuffisants ou document introuvable).',
    };
  }
  return { ok: true, updatedId: (data as { id: number }).id };
}

export async function insertDevisRecord(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; errorCode?: string; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.from('devis').insert(payload as never).select('*').single();
  if (error) {
    return { ok: false, error: error.message, errorCode: error.code };
  }
  return { ok: true, data: data as Record<string, unknown> };
}

export async function patchDevisAttachments(
  devisId: number,
  attachmentUrls: unknown
): Promise<{ ok: boolean; error?: string }> {
  const companyId = requireActiveCompanyId();
  let q = supabase.from('devis').update({ attachment_urls: attachmentUrls } as never).eq('id', devisId);
  q = filterByCompanyId(q, companyId);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

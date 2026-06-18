import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import type { Devis } from '@/types';

type ConfirmedDevisInput = Pick<
  Devis,
  'type' | 'devis_number' | 'devis_date' | 'third_party_name' | 'third_party_phone'
>;

/** After confirming a vente devis, add a client suivi row (skip if same N° devis exists). */
export async function ensureSuiviClientFromConfirmedDevis(
  devis: ConfirmedDevisInput,
  userId: string | null
): Promise<'created' | 'skipped' | 'failed'> {
  if (devis.type !== 'vente') return 'skipped';

  const societe = devis.third_party_name?.trim();
  if (!societe) return 'skipped';

  const companyId = getActiveCompanyId();
  if (!companyId) return 'failed';

  const devisNumber = devis.devis_number?.trim();
  if (devisNumber) {
    const { data: existing, error: lookupError } = await supabase
      .from('parties_suivi')
      .select('id')
      .eq('company_id', companyId)
      .eq('party_type', 'client')
      .eq('devis_number', devisNumber)
      .maybeSingle();

    if (lookupError) {
      console.warn('[partiesSuivi] lookup failed', lookupError.message);
      return 'failed';
    }
    if (existing) return 'skipped';
  }

  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('parties_suivi').insert({
    company_id: companyId,
    party_type: 'client',
    societe,
    devis_date: devis.devis_date || null,
    devis_number: devisNumber || null,
    telephone: devis.third_party_phone?.trim() || null,
    reponse: 'Devis confirmé — suivi créé automatiquement',
    dernier_contact_date: today,
    created_by: userId,
  });

  if (error) {
    console.warn('[partiesSuivi] auto create failed', error.message);
    return 'failed';
  }

  return 'created';
}

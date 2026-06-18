import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import type { Devis } from '@/types';

type DevisSuiviInput = Pick<
  Devis,
  'type' | 'devis_number' | 'devis_date' | 'third_party_name' | 'third_party_phone'
>;

function partyTypeForDevis(type: Devis['type']): 'client' | 'fournisseur' | null {
  if (type === 'vente') return 'client';
  if (type === 'achat') return 'fournisseur';
  return null;
}

/** Create a suivi row when a devis client/fournisseur is saved (skip duplicate N° devis). */
export async function ensureSuiviFromDevis(
  devis: DevisSuiviInput,
  userId: string | null
): Promise<'created' | 'skipped' | 'failed'> {
  const partyType = partyTypeForDevis(devis.type);
  if (!partyType) return 'skipped';

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
      .eq('party_type', partyType)
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
    party_type: partyType,
    societe,
    devis_date: devis.devis_date || null,
    devis_number: devisNumber || null,
    telephone: devis.third_party_phone?.trim() || null,
    reponse: 'Devis créé — suivi automatique',
    dernier_contact_date: today,
    created_by: userId,
  });

  if (error) {
    console.warn('[partiesSuivi] auto create failed', error.message);
    return 'failed';
  }

  return 'created';
}

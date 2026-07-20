import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

type DriverEmployeeInput = {
  userId: string;
  prenom: string;
  nom: string;
  email: string;
  phone?: string | null;
  cin?: string | null;
  role: string;
};

/** Create or update the fleet `employees` row linked to a chauffeur auth account. */
export async function ensureDriverEmployeeRecord(
  params: DriverEmployeeInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const companyId = requireActiveCompanyId();
  const payload = {
    prenom: params.prenom.trim(),
    nom: params.nom.trim(),
    email: params.email.trim(),
    phone: params.phone?.trim() || null,
    cin: params.cin?.trim() || null,
    role: params.role,
    user_id: params.userId,
    company_id: companyId,
  };

  const { data: byUser, error: lookupErr } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', params.userId)
    .maybeSingle();

  if (lookupErr) {
    return { ok: false, message: lookupErr.message };
  }

  if (byUser?.id) {
    const { error } = await supabase.from('employees').update(payload).eq('id', byUser.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  const { data: byEmail, error: emailLookupErr } = await supabase
    .from('employees')
    .select('id')
    .ilike('email', params.email.trim())
    .maybeSingle();

  if (emailLookupErr) {
    return { ok: false, message: emailLookupErr.message };
  }

  if (byEmail?.id) {
    const { error } = await supabase.from('employees').update(payload).eq('id', byEmail.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  const { error: insertErr } = await supabase.from('employees').insert(payload as never);
  if (insertErr) return { ok: false, message: insertErr.message };
  return { ok: true };
}

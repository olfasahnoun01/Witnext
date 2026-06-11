import { supabase } from '@/integrations/supabase/client';

/** Last approved voucher km final for a vehicle — becomes the next voucher's km initial. */
export async function fetchLastApprovedKmFinal(vehicleId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('fuel_vouchers')
    .select('km')
    .eq('vehicule_id', vehicleId)
    .eq('status', 'approved')
    .not('km', 'is', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[fuelVoucherKm] fetchLastApprovedKmFinal:', error.message);
    return null;
  }

  if (data?.km == null) return null;
  const km = Number(data.km);
  return Number.isFinite(km) ? km : null;
}

export function computeFuelVoucherDistance(
  kmFinal: number | null | undefined,
  kmInitial: number | null | undefined
): number | null {
  if (kmFinal == null || kmInitial == null) return null;
  const delta = Number(kmFinal) - Number(kmInitial);
  return Number.isFinite(delta) ? delta : null;
}

import { supabase } from '@/integrations/supabase/client';

export type MfaAalLevel = 'aal1' | 'aal2' | null;

export type VerifiedTotpFactor = {
  id: string;
  friendlyName: string;
  status: 'verified';
};

/** True when the user has MFA enrolled but this session is still only password-verified. */
export async function needsMfaVerification(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    console.warn('[mfa] getAuthenticatorAssuranceLevel:', error.message);
    return false;
  }
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export async function getMfaAssuranceLevel(): Promise<{
  currentLevel: MfaAalLevel;
  nextLevel: MfaAalLevel;
}> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    return { currentLevel: null, nextLevel: null };
  }
  return {
    currentLevel: (data.currentLevel as MfaAalLevel) ?? null,
    nextLevel: (data.nextLevel as MfaAalLevel) ?? null,
  };
}

export async function listVerifiedTotpFactors(): Promise<VerifiedTotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data.totp ?? [])
    .filter((f) => f.status === 'verified')
    .map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name || 'Authentificateur',
      status: 'verified' as const,
    }));
}

export async function verifyTotpCode(code: string, factorId?: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, error: 'Saisissez le code à 6 chiffres.' };
  }

  let id = factorId;
  if (!id) {
    const factors = await listVerifiedTotpFactors();
    id = factors[0]?.id;
  }
  if (!id) {
    return { ok: false, error: 'Aucun facteur MFA actif trouvé.' };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: id,
  });
  if (challengeError) {
    return { ok: false, error: challengeError.message };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: id,
    challengeId: challenge.id,
    code: trimmed,
  });
  if (verifyError) {
    return { ok: false, error: 'Code incorrect ou expiré. Réessayez.' };
  }

  return { ok: true };
}

export async function enrollTotpFactor(friendlyName = 'Witnext'): Promise<{
  ok: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}> {
  // Clean up unverified leftover factors so enroll does not hit the 10-factor cap.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const unverified = (factors?.all ?? []).filter((f) => f.status === 'unverified');
  for (const f of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function confirmTotpEnrollment(
  factorId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  return verifyTotpCode(code, factorId);
}

export async function unenrollMfaFactor(factorId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

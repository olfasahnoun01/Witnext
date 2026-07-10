import { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import {
  confirmTotpEnrollment,
  enrollTotpFactor,
  listVerifiedTotpFactors,
  unenrollMfaFactor,
  type VerifiedTotpFactor,
} from '@/lib/mfa';
import { useToast } from '@/hooks/use-toast';

type MfaSettingsCardProps = {
  /** Compact mode for dialogs */
  compact?: boolean;
};

export function MfaSettingsCard({ compact = false }: MfaSettingsCardProps) {
  const { toast } = useToast();
  const [factors, setFactors] = useState<VerifiedTotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listVerifiedTotpFactors();
      setFactors(list);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur MFA',
        description: err instanceof Error ? err.message : 'Chargement impossible',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startEnroll = async () => {
    setError(null);
    setEnrolling(true);
    setCode('');
    const result = await enrollTotpFactor('Witnext');
    if (!result.ok) {
      setEnrolling(false);
      setError(result.error ?? 'Impossible de démarrer l’enrollment');
      return;
    }
    setFactorId(result.factorId ?? null);
    setQrCode(result.qrCode ?? null);
    setSecret(result.secret ?? null);
  };

  const cancelEnroll = async () => {
    if (factorId) {
      await unenrollMfaFactor(factorId);
    }
    setEnrolling(false);
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    setError(null);
  };

  const confirmEnroll = async (value: string) => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmTotpEnrollment(factorId, value);
      if (!result.ok) {
        setError(result.error ?? 'Code invalide');
        setCode('');
        return;
      }
      toast({
        title: 'MFA activée',
        description: 'La double authentification est maintenant active sur votre compte.',
      });
      setEnrolling(false);
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (id: string) => {
    const confirmed = window.confirm(
      'Désactiver ce facteur MFA ? Vous pourrez vous reconnecter avec le mot de passe seul jusqu’à réactivation.'
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await unenrollMfaFactor(id);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error,
        });
        return;
      }
      toast({ title: 'MFA désactivée', description: 'Le facteur a été retiré.' });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">Authentification à deux facteurs</h3>
            {factors.length > 0 ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Protégez votre compte avec une application d’authentification (Google Authenticator,
            Authy, 1Password…).
          </p>
        </div>
      </div>

      {factors.length > 0 && !enrolling ? (
        <ul className="space-y-2">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">{f.friendlyName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void removeFactor(f.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!enrolling ? (
        <Button type="button" variant={factors.length ? 'outline' : 'default'} onClick={() => void startEnroll()}>
          {factors.length ? 'Ajouter un autre appareil' : 'Activer la MFA'}
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Scannez ce QR code avec votre application d’authentification, puis saisissez le code
            affiché.
          </p>
          {qrCode ? (
            <div className="flex justify-center rounded-lg bg-white p-3">
              <img src={qrCode} alt="QR code MFA" className="h-48 w-48" />
            </div>
          ) : null}
          {secret ? (
            <p className="break-all text-center text-xs text-muted-foreground">
              Clé manuelle : <span className="font-mono text-foreground">{secret}</span>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label>Code de confirmation</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError(null);
                }}
                onComplete={(v) => void confirmEnroll(v)}
                disabled={busy}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={() => void confirmEnroll(code)}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmer
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void cancelEnroll()}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { verifyTotpCode } from '@/lib/mfa';

type MfaChallengeFormProps = {
  title?: string;
  description?: string;
  onVerified: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
};

export function MfaChallengeForm({
  title = 'Vérification en deux étapes',
  description = 'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres.',
  onVerified,
  onCancel,
  cancelLabel = 'Annuler',
}: MfaChallengeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (value: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyTotpCode(value);
      if (!result.ok) {
        setError(result.error ?? 'Vérification impossible');
        setCode('');
        return;
      }
      onVerified();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mfa-otp">Code d’authentification</Label>
        <div className="flex justify-center sm:justify-start">
          <InputOTP
            id="mfa-otp"
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
            }}
            onComplete={(v) => void submit(v)}
            disabled={submitting}
            autoFocus
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
          disabled={submitting || code.length !== 6}
          onClick={() => void submit(code)}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Vérifier
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

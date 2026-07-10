import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { needsMfaVerification } from '@/lib/mfa';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';

/**
 * Blocks the ERP shell until MFA is verified when the user has enrolled factors.
 * Password-only sessions (aal1 with nextLevel aal2) must complete TOTP first.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setRequiresMfa(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const needed = await needsMfaVerification();
      setRequiresMfa(needed);
    } finally {
      setChecking(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiresMfa) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(168_100%_39%/0.08),transparent_55%)]" />
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="relative z-10 w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <WitnextLogoBanner variant="auth" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl ring-1 ring-primary/5">
            <MfaChallengeForm
              onVerified={() => {
                setRequiresMfa(false);
              }}
              onCancel={() => {
                void supabase.auth.signOut({ scope: 'global' });
              }}
              cancelLabel="Se déconnecter"
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

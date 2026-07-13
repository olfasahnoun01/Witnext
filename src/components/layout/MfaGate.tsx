import { useEffect, useRef, useState } from 'react';
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
 *
 * Important: do not re-run a blocking check on every session object change
 * (TOKEN_REFRESHED on tab focus). That unmounted the whole ERP tree and wiped forms.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [checking, setChecking] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      checkedUserIdRef.current = null;
      setRequiresMfa(false);
      setChecking(false);
      return;
    }

    // Same user after token refresh / tab wake — keep children mounted.
    if (checkedUserIdRef.current === userId) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    void (async () => {
      try {
        const needed = await needsMfaVerification();
        if (cancelled) return;
        setRequiresMfa(needed);
        checkedUserIdRef.current = userId;
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

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
                if (userId) checkedUserIdRef.current = userId;
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

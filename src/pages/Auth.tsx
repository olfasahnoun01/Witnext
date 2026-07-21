import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase, supabaseProjectUrl } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { clearSupabaseBrowserSession } from '@/lib/supabaseAuthStorage';
import { needsMfaVerification } from '@/lib/mfa';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, LogIn, AlertCircle, RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import {
  getUserPositionFromMetadata,
  shouldAutoRedirectToBoss,
} from '@/lib/bossAccess';

const isWebTarget = import.meta.env.VITE_APP_TARGET !== 'electron';
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
/** Web login sends captcha to Supabase when the site key is configured. */
const captchaConfigured = isWebTarget && turnstileSiteKey.length > 0;
/** Supabase captcha is enabled server-side — site key must be set for web. */
const captchaConfigMissing = isWebTarget && turnstileSiteKey.length === 0;

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionExpiredAlert, setShowSessionExpiredAlert] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [checkingMfa, setCheckingMfa] = useState(false);
  const captchaRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { session, isLoading: authLoading, isAdmin, isModerator } = useAuth();

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    captchaRef.current?.reset();
  }, []);

  const goAfterAuth = useCallback(() => {
    const position = session?.user
      ? getUserPositionFromMetadata(session.user)
      : undefined;
    const target = shouldAutoRedirectToBoss({ isAdmin, isModerator, userPosition: position })
      ? '/boss'
      : '/dashboard';
    navigate(target, { replace: true });
  }, [session, isAdmin, isModerator, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setShowSessionExpiredAlert(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (authLoading || mfaPending) return;
    if (!session?.user) {
      setMfaPending(false);
      return;
    }

    let cancelled = false;
    setCheckingMfa(true);
    void (async () => {
      try {
        const needed = await needsMfaVerification();
        if (cancelled) return;
        if (needed) {
          setMfaPending(true);
          return;
        }
        setShowSessionExpiredAlert(false);
        goAfterAuth();
      } finally {
        if (!cancelled) setCheckingMfa(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, mfaPending, goAfterAuth]);

  const handleClearCache = () => {
    clearSupabaseBrowserSession(supabaseProjectUrl);
    sessionStorage.clear();
    window.location.href = '/auth';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (captchaConfigMissing) {
      toast({
        variant: 'destructive',
        title: 'Captcha non configuré',
        description:
          'Ajoutez VITE_TURNSTILE_SITE_KEY dans .env.local, puis redémarrez npm run dev.',
      });
      return;
    }

    if (captchaConfigured && !captchaToken) {
      toast({
        variant: 'destructive',
        title: 'Vérification requise',
        description: 'Veuillez compléter le captcha avant de vous connecter.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
        options: captchaConfigured ? { captchaToken: captchaToken! } : undefined,
      });

      if (error) {
        console.error('Auth error:', error);
        resetCaptcha();

        if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: 'destructive',
            title: 'Erreur de connexion',
            description: 'Email ou mot de passe incorrect',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            variant: 'destructive',
            title: 'Email non confirmé',
            description: 'Veuillez vérifier vos e-mails ou contacter l\'administrateur.',
          });
        } else if (error.message.toLowerCase().includes('captcha')) {
          toast({
            variant: 'destructive',
            title: 'Vérification échouée',
            description: 'Le captcha a expiré ou est invalide. Veuillez réessayer.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: error.message,
          });
        }
        return;
      }

      if (data.user) {
        const needed = await needsMfaVerification();
        if (needed) {
          setMfaPending(true);
          toast({
            title: 'Vérification requise',
            description: 'Saisissez le code de votre application d’authentification.',
          });
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const userName = profileData?.full_name || data.user.email?.split('@')[0] || 'utilisateur';

        toast({
          title: `Bienvenue, ${userName} ! 👋`,
          description: 'Connexion réussie. Ravi de vous revoir sur Witnext.',
        });
      }
    } catch (error: unknown) {
      console.error('Auth Exception:', error);
      resetCaptcha();
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showLoader = authLoading || checkingMfa;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(168_100%_39%/0.08),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(222_47%_11%/0.04),transparent_50%)]" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <WitnextLogoBanner variant="auth" />
        </div>

        {captchaConfigMissing && !mfaPending && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration captcha manquante</AlertTitle>
            <AlertDescription>
              Supabase exige un captcha à la connexion. Ajoutez{' '}
              <code className="text-xs">VITE_TURNSTILE_SITE_KEY</code> dans{' '}
              <code className="text-xs">.env.local</code> (clé publique Turnstile), puis redémarrez{' '}
              <code className="text-xs">npm run dev</code>.
            </AlertDescription>
          </Alert>
        )}

        {showSessionExpiredAlert && !mfaPending && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Session expirée</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                Votre session a expiré ou est devenue invalide. Veuillez vous reconnecter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Réinitialiser et réessayer
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-xl p-8 transition-all ring-1 ring-primary/5">
          {showLoader && !mfaPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : mfaPending ? (
            <MfaChallengeForm
              onVerified={() => {
                setMfaPending(false);
                toast({
                  title: 'Connexion réussie',
                  description: 'Double authentification validée.',
                });
                goAfterAuth();
              }}
              onCancel={() => {
                setMfaPending(false);
                void supabase.auth.signOut({ scope: 'global' });
              }}
              cancelLabel="Se déconnecter"
            />
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-6 text-center">
                <LogIn className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Connexion
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    leftIcon={<Lock className="h-4 w-4" />}
                    required
                    autoComplete="current-password"
                  />
                </div>

                {captchaConfigured && (
                  <div className="flex justify-center overflow-hidden rounded-lg">
                    <Turnstile
                      ref={captchaRef}
                      siteKey={turnstileSiteKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={resetCaptcha}
                      onError={resetCaptcha}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={
                    isLoading ||
                    captchaConfigMissing ||
                    (captchaConfigured && !captchaToken)
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Se connecter
                    </>
                  )}
                </Button>
              </form>

              <p className="text-sm text-center text-muted-foreground mt-6">
                Nouveau sur Witnext ?{' '}
                <Link to="/signup" className="text-primary font-medium hover:underline">
                  Démarrer un essai gratuit
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="text-center space-y-2 mt-6">
          <p className="text-sm text-muted-foreground">
            © 2026 Witnext. Tous droits réservés.
          </p>
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground font-medium">
              Développé par <span className="text-primary">Adam Abdeljalil</span>
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
              Pour signaler un problème veuillez contacter l'administrateur + (216) 56244009
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Building2, User, Rocket, LogIn } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { provisionMyTenant } from '@/lib/tenantService';
import { isValidSignupCompanyName, normalizeCompanyName } from '@/lib/tenantTypes';

const isWebTarget = import.meta.env.VITE_APP_TARGET !== 'electron';
const hcaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() ?? '';
const captchaConfigured = isWebTarget && hcaptchaSiteKey.length > 0;
const captchaConfigMissing = isWebTarget && hcaptchaSiteKey.length === 0;

export default function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, isLoading: authLoading } = useAuth();

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    captchaRef.current?.resetCaptcha();
  }, []);

  useEffect(() => {
    if (!authLoading && session?.user) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCompany = normalizeCompanyName(companyName);
    if (!isValidSignupCompanyName(normalizedCompany)) {
      toast({
        variant: 'destructive',
        title: 'Société requise',
        description: 'Indiquez le nom de votre société (2 caractères minimum).',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Mot de passe trop court',
        description: 'Utilisez au moins 8 caractères.',
      });
      return;
    }

    if (captchaConfigMissing) {
      toast({
        variant: 'destructive',
        title: 'Captcha non configuré',
        description: 'Ajoutez VITE_HCAPTCHA_SITE_KEY dans .env.local.',
      });
      return;
    }

    if (captchaConfigured && !captchaToken) {
      toast({
        variant: 'destructive',
        title: 'Vérification requise',
        description: 'Complétez le captcha avant de continuer.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: normalizedCompany,
          },
          ...(captchaConfigured ? { captchaToken: captchaToken! } : {}),
        },
      });

      if (error) {
        resetCaptcha();
        toast({
          variant: 'destructive',
          title: 'Inscription impossible',
          description: error.message,
        });
        return;
      }

      if (data.session) {
        const provision = await provisionMyTenant({
          companyName: normalizedCompany,
          fullName: fullName.trim(),
        });
        if (!provision.ok) {
          toast({
            variant: 'destructive',
            title: 'Compte créé, provisionnement incomplet',
            description: provision.error,
          });
          return;
        }
        toast({
          title: 'Bienvenue sur Witnext',
          description: 'Votre espace est prêt. Bon démarrage !',
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      toast({
        title: 'Vérifiez votre e-mail',
        description:
          'Un lien de confirmation a été envoyé. Après validation, connectez-vous pour activer votre espace.',
      });
      navigate('/auth', { replace: true });
    } catch (err) {
      resetCaptcha();
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur est survenue',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(168_100%_39%/0.08),transparent_55%)]" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <WitnextLogoBanner variant="auth" />
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xl p-8 ring-1 ring-primary/5">
          <div className="flex items-center justify-center gap-2 mb-2 text-center">
            <Rocket className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Essai gratuit 14 jours</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Créez votre société et le compte administrateur en quelques secondes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de la société</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  placeholder="Ex: Acme SARL"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Votre nom</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Prénom Nom"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email administrateur</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@votresociete.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <PasswordInput
                id="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                leftIcon={<Lock className="h-4 w-4" />}
                required
                autoComplete="new-password"
              />
            </div>

            {captchaConfigured && (
              <div className="flex justify-center overflow-hidden rounded-lg">
                <HCaptcha
                  ref={captchaRef}
                  sitekey={hcaptchaSiteKey}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={resetCaptcha}
                  onError={resetCaptcha}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isLoading || captchaConfigMissing || (captchaConfigured && !captchaToken)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Démarrer l&apos;essai
                </>
              )}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Déjà client ?{' '}
            <Link to="/auth" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" />
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, LogIn, AlertCircle, RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import grosafeLogo from '@/assets/grosafe-logo-new.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionExpiredAlert, setShowSessionExpiredAlert] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check if redirected due to session expiration
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setShowSessionExpiredAlert(true);
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setShowSessionExpiredAlert(false);
        navigate('/', { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.search]);

  // Function to clear browser cache and reload
  const handleClearCache = () => {
    // Clear all auth-related storage
    localStorage.removeItem('sb-lptoakdzyuhkfvslgpsw-auth-token');
    sessionStorage.clear();
    
    // Remove the expired param and reload
    window.location.href = '/auth';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Auth error:", error);
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
        } else {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: error.message,
          });
        }
        return;
      }

      // Fetch user profile for personalized welcome message
      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const userName = profileData?.full_name || data.user.email?.split('@')[0] || 'utilisateur';
        
        toast({
          title: `Bienvenue, ${userName} ! 👋`,
          description: 'Connexion réussie. Ravi de vous revoir sur Grosafe Gestion.',
        });
      }
    } catch (error: any) {
      console.error("Auth Exception:", error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-2xl p-4 mb-4">
            <img 
              src={grosafeLogo} 
              alt="Grosafe Équipement" 
              className="h-40 w-auto object-contain"
            />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Système de gestion d'inventaire
          </p>
        </div>

        {/* Session Expired Alert */}
        {showSessionExpiredAlert && (
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

        {/* Auth Card */}
        <div className="bg-card rounded-2xl border border-border shadow-xl p-8 transition-all">
          <div className="flex items-center justify-center gap-2 mb-6 text-center">
            <LogIn className="w-5 h-5 text-primary" />
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
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isLoading}>
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
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © 2026 Grosafe Équipement. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}

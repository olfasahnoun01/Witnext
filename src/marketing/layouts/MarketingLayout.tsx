import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { MarketingFooter } from '@/marketing/components/MarketingFooter';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/trial', label: 'Essai gratuit' },
] as const;

export function MarketingLayout() {
  const location = useLocation();
  const { session } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <WitnextLogoBanner className="h-9 w-auto" />
            <span className="hidden font-bold text-lg tracking-tight sm:inline">Witnext</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === link.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Accéder à l&apos;application</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/auth">Connexion</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/trial">Essai gratuit</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <MarketingFooter />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Accueil', exact: true },
  { href: '/pricing', label: 'Tarifs', exact: false },
  { href: '/trial', label: 'Essai gratuit', exact: false },
  { href: '/buy', label: 'Licences', exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingNavbar() {
  const location = useLocation();
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinkClass = (href: string, exact: boolean) =>
    cn(
      'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive(location.pathname, href, exact)
        ? 'text-primary bg-primary/10'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
    );

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/85'
          : 'border-b border-transparent bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <WitnextLogoBanner className="h-9 w-auto sm:h-10" />
          <span className="font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Witnext
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} to={link.href} className={navLinkClass(link.href, link.exact)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {session ? (
            <Button asChild size="sm" className="hidden sm:inline-flex shadow-sm">
              <Link to="/dashboard">
                <span className="hidden sm:inline">Accéder à l&apos;application</span>
                <span className="sm:hidden">Application</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex text-muted-foreground"
              >
                <Link to="/auth">Connexion</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex shadow-md shadow-primary/20">
                <Link to="/trial">Essai gratuit</Link>
              </Button>
            </>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden h-9 w-9 shrink-0"
                aria-label="Ouvrir le menu"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <WitnextLogoBanner className="h-8 w-auto" />
                  Witnext
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Navigation mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      'rounded-lg px-4 py-3 text-base font-medium transition-colors',
                      isActive(location.pathname, link.href, link.exact)
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
                {session ? (
                  <Button asChild className="w-full">
                    <Link to="/dashboard">Accéder à l&apos;application</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/auth">Connexion</Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link to="/trial">Essai gratuit</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

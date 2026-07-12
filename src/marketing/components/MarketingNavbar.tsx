import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { WitnextWordmark } from '@/marketing/components/WitnextWordmark';

const NAV_LINKS = [
  { href: '/', label: 'Accueil', exact: true },
  { href: '/pricing', label: 'Tarifs', exact: false },
  { href: '/trial?plan=pro', label: 'Essai gratuit', exact: false },
  { href: '/buy', label: 'Licences', exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  const path = href.split('?')[0] ?? href;
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
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
        ? 'marketing-nav-active'
        : 'text-slate-600 dark:text-slate-300 marketing-nav-hover'
    );

  return (
    <header
      className={cn(
        'marketing-chrome sticky top-0 z-50 transition-all duration-300 border-b marketing-chrome-border',
        scrolled ? 'shadow-sm' : 'border-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <WitnextLogoBanner className="h-9 w-auto sm:h-10" />
          <WitnextWordmark className="text-lg sm:text-xl" />
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} to={link.href} className={navLinkClass(link.href, link.exact)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="marketing-theme-toggle" />

          {session ? (
            <Button asChild size="sm" className="hidden sm:inline-flex shadow-sm marketing-btn">
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
                className="hidden md:inline-flex text-slate-600 dark:text-slate-300 marketing-btn-ghost"
              >
                <Link to="/auth">Connexion</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex shadow-md marketing-btn">
                <Link to="/trial?plan=pro">Essai gratuit</Link>
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
            <SheetContent
              side="right"
              className="marketing-chrome w-[min(100vw-2rem,320px)] border-l marketing-chrome-border [&>button]:text-current [&>button]:opacity-80 [&>button]:hover:opacity-100"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left text-current">
                  <WitnextLogoBanner className="h-8 w-auto" />
                  <WitnextWordmark />
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
                        ? 'marketing-nav-active'
                        : 'text-slate-900 dark:text-slate-100 marketing-nav-hover'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-8 flex flex-col gap-3 border-t marketing-chrome-border pt-6">
                {session ? (
                  <Button asChild className="w-full marketing-btn">
                    <Link to="/dashboard">Accéder à l&apos;application</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full marketing-btn-outline border-border text-foreground"
                    >
                      <Link to="/auth">Connexion</Link>
                    </Button>
                    <Button asChild className="w-full marketing-btn">
                      <Link to="/trial?plan=pro">Essai gratuit</Link>
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

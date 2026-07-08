import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Wallet,
  Car,
  Shield,
  Building2,
  Monitor,
  ArrowRight,
} from 'lucide-react';
import { MARKETING_MODULES } from '@/marketing/config/pricing';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';

const MODULE_ICONS: Record<string, typeof Briefcase> = {
  commercial: Briefcase,
  ventes: ShoppingCart,
  achats: ShoppingBag,
  magasin: Package,
  rh: Users,
  finance: Wallet,
  vehicules: Car,
};

const BENEFITS = [
  { icon: Building2, title: 'Multi-sociétés', text: 'Gérez plusieurs entités depuis une seule plateforme.' },
  { icon: Shield, title: 'Sécurité RLS', text: 'Isolation des données par société et permissions fines.' },
  { icon: Monitor, title: 'Web + Desktop', text: 'ERP navigateur et application Windows pour le terrain.' },
  { icon: Wallet, title: 'Fiscalité TN', text: 'Tableaux de bord et déclarations adaptés à la Tunisie.' },
];

const CLIENT_LOGOS = ['Grosafe', 'Granisafe', 'Safe-Team'];

export function HomePage() {
  const { session } = useAuth();
  useMarketingPageTitle(
    'Witnext — ERP pour entreprises tunisiennes',
    'Découvrez Witnext : gestion commerciale, stock, finance, RH et flotte. Demandez un essai gratuit.'
  );

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            ERP tout-en-un
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl max-w-3xl">
            Pilotez votre entreprise avec{' '}
            <span className="text-primary">Witnext</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Commercial, ventes, achats, magasin, finance, ressources humaines et flotte —
            une suite intégrée pour les équipes qui veulent gagner en visibilité et en efficacité.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session ? (
              <Button asChild size="lg">
                <Link to="/dashboard">
                  Accéder à l&apos;application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link to="/trial">Essai gratuit</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/pricing">Voir les offres</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-center mb-10">Modules intégrés</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MARKETING_MODULES.map((mod) => {
              const Icon = MODULE_ICONS[mod.id] ?? Package;
              return (
                <div
                  key={mod.id}
                  className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
                >
                  <Icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-center mb-10">Pourquoi Witnext ?</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="text-center p-4">
                <b.icon className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Ils nous font confiance</p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {CLIENT_LOGOS.map((name) => (
              <span key={name} className="text-lg font-bold text-muted-foreground/80">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold">Prêt à transformer votre gestion ?</h2>
          <p className="text-muted-foreground mt-3">
            Demandez un essai gratuit ou contactez-nous pour une licence adaptée à votre structure.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/trial">Essai gratuit</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/buy">Acheter une licence</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

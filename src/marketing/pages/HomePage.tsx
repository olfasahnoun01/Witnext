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
  CheckCircle2,
} from 'lucide-react';
import { MARKETING_MODULES } from '@/marketing/config/pricing';
import { getMarketingModuleTheme } from '@/marketing/config/moduleThemes';
import { cn } from '@/lib/utils';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { MarketingVideo } from '@/marketing/components/MarketingVideo';
import { WitnextHeroBrand } from '@/marketing/components/WitnextHeroBrand';
import { BRAND_GREEN_TW } from '@/marketing/config/brand';

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

const STATS = [
  { value: '7+', label: 'Modules métiers' },
  { value: '100%', label: 'Données sécurisées' },
  { value: '48h', label: 'Activation essai' },
  { value: '24/7', label: 'Accès cloud' },
];

const HIGHLIGHTS = [
  'Devis, commandes et facturation unifiés',
  'Stock et magasin en temps réel',
  'RH, flotte et maintenance intégrés',
];

export function HomePage() {
  const { session } = useAuth();
  useMarketingPageTitle(
    'Witnext — ERP pour entreprises tunisiennes',
    'Découvrez Witnext : gestion commerciale, stock, finance, RH et flotte. Demandez un essai gratuit.'
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 marketing-hero-gradient pointer-events-none" />
        <div className="absolute inset-0 marketing-grid-pattern opacity-40 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-center">
            <div>
              <AnimateIn animation="fade-up" delay={80}>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl xl:text-6xl leading-[1.1]">
                  Pilotez votre entreprise avec{' '}
                  <WitnextHeroBrand />
                </h1>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={160}>
                <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Commercial, ventes, achats, magasin, finance, ressources humaines et flotte,
                  une suite intégrée pour gagner en visibilité et en efficacité.
                </p>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={240}>
                <ul className="mt-5 space-y-2">
                  {HIGHLIGHTS.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 marketing-brand-text shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={320}>
                <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
                  {session ? (
                    <Button asChild size="lg" className="w-full sm:w-auto marketing-btn">
                      <Link to="/dashboard">
                        Accéder à l&apos;application
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="w-full sm:w-auto marketing-btn">
                        <Link to="/trial">Essai gratuit</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="w-full sm:w-auto marketing-btn-outline">
                        <Link to="/pricing">Voir les offres</Link>
                      </Button>
                    </>
                  )}
                </div>
              </AnimateIn>
            </div>

            <AnimateIn animation="slide-left" delay={200} className="w-full">
              <MarketingVideo variant="hero" className="w-full marketing-float" />
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((stat, i) => (
              <AnimateIn key={stat.label} animation="scale-in" delay={i * 80} className="text-center">
                <p className="text-2xl sm:text-3xl font-black marketing-brand-text">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Demo section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <AnimateIn animation="slide-right">
              <p className="text-sm font-semibold marketing-brand-text uppercase tracking-wider mb-3">
                Démonstration
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Visualisez votre activité en un coup d&apos;œil
              </h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Tableaux de bord, indicateurs commerciaux, suivi de stock et reporting RH —
                Witnext centralise l&apos;information pour des décisions plus rapides.
              </p>
              <Button asChild className="mt-6 marketing-btn-secondary" variant="secondary">
                <Link to="/trial">
                  Demander une démo personnalisée
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </AnimateIn>
            <AnimateIn animation="slide-left" delay={120}>
              <MarketingVideo variant="section" />
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-16 sm:py-24 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Modules intégrés</h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base">
              Une architecture modulaire qui couvre l&apos;ensemble de vos processus métier.
            </p>
          </AnimateIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MARKETING_MODULES.map((mod, i) => {
              const Icon = MODULE_ICONS[mod.id] ?? Package;
              const theme = getMarketingModuleTheme(mod.id);
              return (
                <AnimateIn key={mod.id} animation="fade-up" delay={i * 60}>
                  <div
                    className={cn(
                      'group h-full rounded-2xl border border-border bg-card p-5 sm:p-6',
                      'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                      theme.borderHover,
                      theme.shadowHover
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl mb-4 transition-colors duration-300',
                        theme.iconIdle,
                        theme.iconHover
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className={cn('font-semibold text-base transition-colors duration-300', theme.titleHover)}>
                      {mod.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{mod.description}</p>
                  </div>
                </AnimateIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Pourquoi Witnext ?</h2>
          </AnimateIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <AnimateIn key={b.title} animation="fade-up" delay={i * 80}>
                <div className="group text-center rounded-2xl border border-border/60 bg-card/50 p-6 h-full hover:bg-card transition-colors">
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(${BRAND_GREEN_TW})/0.1] mb-4 group-hover:bg-[hsl(${BRAND_GREEN_TW})/0.18] transition-colors`}>
                    <b.icon className="h-6 w-6 marketing-brand-text" />
                  </div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{b.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="scale-in">
            <div className={`relative overflow-hidden rounded-3xl border border-[hsl(${BRAND_GREEN_TW})/0.25] bg-gradient-to-br from-[hsl(${BRAND_GREEN_TW})/0.1] via-background to-[hsl(${BRAND_GREEN_TW})/0.05] px-6 py-12 sm:px-12 sm:py-16 text-center`}>
              <div className={`absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[hsl(${BRAND_GREEN_TW})/0.2] blur-3xl marketing-pulse-glow pointer-events-none`} />
              <h2 className="text-2xl sm:text-3xl font-bold relative">
                Prêt à transformer votre gestion ?
              </h2>
              <p className="text-muted-foreground mt-3 max-w-lg mx-auto relative text-sm sm:text-base">
                Demandez un essai gratuit ou contactez-nous pour une licence adaptée à votre structure.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 relative">
                <Button asChild size="lg" className="w-full sm:w-auto marketing-btn">
                  <Link to="/trial">Essai gratuit</Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto marketing-btn-secondary">
                  <Link to="/buy">Acheter une licence</Link>
                </Button>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}

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
  ArrowRight,
} from 'lucide-react';
import { MARKETING_MODULES } from '@/marketing/config/pricing';
import {
  FINAL_CTA,
  HOME_HERO,
  HOME_STEPS,
  PRICING_FAQ,
  TUNISIA_PAINS,
  TUNISIA_WINS,
} from '@/marketing/config/strategy';
import { getMarketingModuleTheme } from '@/marketing/config/moduleThemes';
import { cn } from '@/lib/utils';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { MarketingVideo } from '@/marketing/components/MarketingVideo';
import { PricingCards } from '@/marketing/components/PricingCards';
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

export function HomePage() {
  const { session } = useAuth();
  useMarketingPageTitle(
    'Witnext — ERP pour entreprises tunisiennes',
    'ERP cloud + desktop : stock, commercial, finance tunisienne (TEJ), flotte. Essai gratuit 14 jours. À partir de 149 DT/mois HT.'
  );

  return (
    <>
      {/* Hero — brand, one headline, one line, CTAs, one visual */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 marketing-hero-gradient pointer-events-none" />
        <div className="absolute inset-0 marketing-grid-pattern opacity-40 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-center">
            <div>
              <AnimateIn animation="fade-up" delay={80}>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl xl:text-6xl leading-[1.1]">
                  {HOME_HERO.headlineBeforeBrand} <WitnextHeroBrand />
                </h1>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={160}>
                <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  {HOME_HERO.support}
                </p>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={240}>
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
                        <Link to="/trial?plan=pro">{HOME_HERO.primaryCta}</Link>
                      </Button>
                      <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto marketing-btn-outline"
                      >
                        <Link to="/pricing">{HOME_HERO.secondaryCta}</Link>
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

      {/* Tunisie — pain → win */}
      <section className="py-16 sm:py-24 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="max-w-2xl mb-12">
            <p className="text-sm font-semibold marketing-brand-text uppercase tracking-wider mb-3">
              Pensé pour la Tunisie
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Remplacez les tableurs par un ERP local
            </h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
              Fiscalité, retenues TEJ, multi-sociétés et terrain — sans empiler Excel et outils
              étrangers mal adaptés.
            </p>
          </AnimateIn>

          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Ce qui freine aujourd&apos;hui
              </p>
              <ul className="space-y-6">
                {TUNISIA_PAINS.map((item, i) => (
                  <AnimateIn key={item.title} animation="fade-up" delay={i * 80}>
                    <li>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {item.text}
                      </p>
                    </li>
                  </AnimateIn>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider marketing-brand-text mb-4">
                Ce que Witnext apporte
              </p>
              <ul className="space-y-6">
                {TUNISIA_WINS.map((item, i) => (
                  <AnimateIn key={item.title} animation="fade-up" delay={i * 80 + 40}>
                    <li>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {item.text}
                      </p>
                    </li>
                  </AnimateIn>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24 bg-muted/20 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Démarrer en trois étapes</h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base">
              Pas de carte bancaire pour l&apos;essai — notre équipe active votre espace.
            </p>
          </AnimateIn>
          <div className="grid gap-8 sm:grid-cols-3">
            {HOME_STEPS.map((s, i) => (
              <AnimateIn key={s.step} animation="fade-up" delay={i * 100}>
                <p className="text-sm font-black marketing-brand-text tabular-nums">{s.step}</p>
                <h3 className="mt-2 font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-16 sm:py-24 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Une suite, sept modules</h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base">
              Commercial, stock, finance et flotte partagent la même base de données.
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
                    <h3
                      className={cn(
                        'font-semibold text-base transition-colors duration-300',
                        theme.titleHover
                      )}
                    >
                      {mod.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </AnimateIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 sm:py-24 bg-muted/20 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold">Des tarifs clairs, en dinars</h2>
            <p className="text-muted-foreground mt-3 text-sm sm:text-base">
              Commencez à 149 DT/mois HT. L&apos;annuel vous fait gagner environ deux mois.
            </p>
          </AnimateIn>
          <PricingCards compact />
          <AnimateIn animation="fade-up" delay={120} className="text-center mt-8">
            <Button asChild variant="outline" className="marketing-btn-outline">
              <Link to="/pricing">
                Comparer les offres en détail
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </AnimateIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 border-b border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Questions fréquentes</h2>
          </AnimateIn>
          <div className="space-y-6">
            {PRICING_FAQ.map((item, i) => (
              <AnimateIn key={item.q} animation="fade-up" delay={i * 60}>
                <h3 className="font-semibold">{item.q}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.a}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="scale-in">
            <div
              className={`relative overflow-hidden rounded-3xl border border-[hsl(${BRAND_GREEN_TW})/0.25] bg-gradient-to-br from-[hsl(${BRAND_GREEN_TW})/0.1] via-background to-[hsl(${BRAND_GREEN_TW})/0.05] px-6 py-12 sm:px-12 sm:py-16 text-center`}
            >
              <div
                className={`absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[hsl(${BRAND_GREEN_TW})/0.2] blur-3xl marketing-pulse-glow pointer-events-none`}
              />
              <h2 className="text-2xl sm:text-3xl font-bold relative">{FINAL_CTA.title}</h2>
              <p className="text-muted-foreground mt-3 max-w-lg mx-auto relative text-sm sm:text-base">
                {FINAL_CTA.text}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 relative">
                <Button asChild size="lg" className="w-full sm:w-auto marketing-btn">
                  <Link to="/trial?plan=pro">{FINAL_CTA.primary}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto marketing-btn-secondary"
                >
                  <Link to="/buy?plan=entreprise">{FINAL_CTA.secondary}</Link>
                </Button>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}

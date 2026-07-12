import { Link } from 'react-router-dom';
import { PricingCards } from '@/marketing/components/PricingCards';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { PRICING_FAQ, TRUST_BULLETS } from '@/marketing/config/strategy';
import { PRICING_VAT_NOTE } from '@/marketing/config/pricing';
import { Check } from 'lucide-react';

export function PricingPage() {
  useMarketingPageTitle(
    'Tarifs Witnext',
    'Essentiel 149 DT/mois, Pro 399 DT/mois, Entreprise sur devis. TVA 19 % en sus. Essai gratuit.'
  );

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Licences
          </p>
          <h1 className="text-3xl font-black sm:text-4xl lg:text-5xl tracking-tight">
            Tarifs transparents en DT
          </h1>
          <p className="text-muted-foreground mt-4 text-sm sm:text-base leading-relaxed">
            Choisissez Essentiel pour démarrer, Pro pour la suite PME (finance TN, flotte), ou
            Entreprise pour le multi-sociétés. {PRICING_VAT_NOTE}.
          </p>
        </AnimateIn>

        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 text-sm text-muted-foreground">
          {TRUST_BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 marketing-brand-text shrink-0" />
              {b}
            </li>
          ))}
        </ul>

        <PricingCards />

        <AnimateIn animation="fade-up" delay={200}>
          <p className="text-center text-sm text-muted-foreground mt-10 sm:mt-14">
            Besoin d&apos;une configuration spécifique ?{' '}
            <Link to="/buy?plan=entreprise" className="marketing-brand-text font-medium hover:underline">
              Contactez notre équipe commerciale
            </Link>
            .
          </p>
        </AnimateIn>

        <section className="mt-16 sm:mt-20 max-w-3xl mx-auto">
          <AnimateIn animation="fade-up" className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold">FAQ tarifs</h2>
          </AnimateIn>
          <div className="space-y-6">
            {PRICING_FAQ.map((item, i) => (
              <AnimateIn key={item.q} animation="fade-up" delay={i * 50}>
                <h3 className="font-semibold text-sm sm:text-base">{item.q}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.a}</p>
              </AnimateIn>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

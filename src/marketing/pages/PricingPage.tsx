import { Link } from 'react-router-dom';
import { PricingCards } from '@/marketing/components/PricingCards';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';

export function PricingPage() {
  useMarketingPageTitle(
    'Tarifs',
    'Offres Witnext ERP : Essentiel, Pro et Entreprise. Essai gratuit et licences sur devis.'
  );

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <AnimateIn animation="fade-up" className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Licences</p>
          <h1 className="text-3xl font-black sm:text-4xl lg:text-5xl tracking-tight">
            Tarifs & offres
          </h1>
          <p className="text-muted-foreground mt-4 text-sm sm:text-base leading-relaxed">
            Choisissez l&apos;offre adaptée à votre taille et à vos modules. Tous les tarifs sont
            établis sur devis — notre équipe vous accompagne pour un déploiement réussi.
          </p>
        </AnimateIn>

        <PricingCards />

        <AnimateIn animation="fade-up" delay={200}>
          <p className="text-center text-sm text-muted-foreground mt-10 sm:mt-14">
            Besoin d&apos;une configuration spécifique ?{' '}
            <Link to="/buy" className="marketing-brand-text font-medium hover:underline">
              Contactez notre équipe commerciale
            </Link>
            .
          </p>
        </AnimateIn>
      </div>
    </div>
  );
}

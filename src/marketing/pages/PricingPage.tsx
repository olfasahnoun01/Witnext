import { Link } from 'react-router-dom';
import { PricingCards } from '@/marketing/components/PricingCards';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';

export function PricingPage() {
  useMarketingPageTitle(
    'Tarifs',
    'Offres Witnext ERP : Essentiel, Pro et Entreprise. Essai gratuit et licences sur devis.'
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl font-black sm:text-4xl">Tarifs & licences</h1>
        <p className="text-muted-foreground mt-4">
          Choisissez l&apos;offre adaptée à votre taille et à vos modules. Tous les tarifs sont
          établis sur devis — notre équipe vous accompagne pour un déploiement réussi.
        </p>
      </div>
      <PricingCards />
      <p className="text-center text-sm text-muted-foreground mt-10">
        Besoin d&apos;une configuration spécifique ?{' '}
        <Link to="/buy" className="text-primary font-medium hover:underline">
          Contactez notre équipe commerciale
        </Link>
        .
      </p>
    </div>
  );
}

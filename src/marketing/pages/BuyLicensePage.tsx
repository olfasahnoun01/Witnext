import { useSearchParams } from 'react-router-dom';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';

export function BuyLicensePage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') ?? undefined;

  useMarketingPageTitle(
    'Acheter une licence',
    'Demandez un devis pour une licence Witnext ERP. Web, desktop ou les deux.'
  );

  return (
    <div className="relative overflow-hidden min-h-[60vh]">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-50" />
      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <AnimateIn animation="fade-up">
          <LeadCaptureForm
            type="license"
            planCode={plan}
            sourcePath="/buy"
            title="Acheter une licence"
            subtitle="Indiquez vos besoins (utilisateurs, déploiement, modules). Notre équipe commerciale vous enverra une proposition."
          />
        </AnimateIn>
      </div>
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';

export function TrialPage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') ?? undefined;

  useMarketingPageTitle(
    'Essai gratuit',
    'Demandez un essai gratuit de Witnext ERP. Notre équipe vous contacte sous 48 h.'
  );

  return (
    <div className="relative overflow-hidden min-h-[60vh]">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-50" />
      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <AnimateIn animation="fade-up">
          <LeadCaptureForm
            type="trial"
            planCode={plan}
            sourcePath="/trial"
            title="Demander un essai gratuit"
            subtitle="Remplissez le formulaire ci-dessous. Nous configurons votre accès et vous recontactons rapidement."
          />
        </AnimateIn>
      </div>
    </div>
  );
}

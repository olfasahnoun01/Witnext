import { useSearchParams } from 'react-router-dom';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';

export function TrialPage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') ?? undefined;

  useMarketingPageTitle(
    'Essai gratuit',
    'Demandez un essai gratuit de Witnext ERP. Notre équipe vous contacte sous 48 h.'
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <LeadCaptureForm
        type="trial"
        planCode={plan}
        sourcePath="/trial"
        title="Demander un essai gratuit"
        subtitle="Remplissez le formulaire ci-dessous. Nous configurons votre accès et vous recontactons rapidement."
      />
    </div>
  );
}

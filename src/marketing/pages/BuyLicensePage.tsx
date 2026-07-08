import { useSearchParams } from 'react-router-dom';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';

export function BuyLicensePage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') ?? undefined;

  useMarketingPageTitle(
    'Acheter une licence',
    'Demandez un devis pour une licence Witnext ERP. Web, desktop ou les deux.'
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <LeadCaptureForm
        type="license"
        planCode={plan}
        sourcePath="/buy"
        title="Acheter une licence"
        subtitle="Indiquez vos besoins (utilisateurs, déploiement, modules). Notre équipe commerciale vous enverra une proposition."
      />
    </div>
  );
}

import { useSearchParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { TRUST_BULLETS } from '@/marketing/config/strategy';
import { formatPlanPrice, getPlanByCode } from '@/marketing/config/pricing';

export function TrialPage() {
  const [searchParams] = useSearchParams();
  const planCode = searchParams.get('plan') ?? 'pro';
  const plan = getPlanByCode(planCode);

  useMarketingPageTitle(
    'Essai gratuit Witnext',
    'Demandez un essai gratuit guidé. Activation sous 48 h. Offre Pro recommandée pour les PME.'
  );

  return (
    <div className="relative overflow-hidden min-h-[60vh]">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-50" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <AnimateIn animation="fade-up" className="lg:pt-2">
            <p className="text-sm font-semibold marketing-brand-text uppercase tracking-wider mb-3">
              Essai gratuit
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Testez Witnext sur vos process réels
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Nous créons votre espace, vous guidez sur stock, commercial et finance. Aucune carte
              bancaire requise.
            </p>
            {plan && (
              <p className="mt-4 text-sm">
                Offre ciblée : <strong>{plan.name}</strong>
                {plan.monthlyPriceHt != null && (
                  <>
                    {' '}
                    ({formatPlanPrice(plan, 'monthly').primary}/mois HT après essai)
                  </>
                )}
              </p>
            )}
            <ul className="mt-6 space-y-2.5">
              {TRUST_BULLETS.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 marketing-brand-text shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">
              Déjà décidé ?{' '}
              <Link
                to={`/buy?plan=${planCode}`}
                className="marketing-brand-text font-medium hover:underline"
              >
                Demander une licence
              </Link>
            </p>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={80}>
            <LeadCaptureForm
              type="trial"
              planCode={planCode}
              sourcePath="/trial"
              title="Demander un essai gratuit"
              subtitle="Remplissez le formulaire. Nous configurons votre accès et vous recontactons sous 48 h."
            />
          </AnimateIn>
        </div>
      </div>
    </div>
  );
}

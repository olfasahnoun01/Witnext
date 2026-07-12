import { useSearchParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { LeadCaptureForm } from '@/marketing/components/LeadCaptureForm';
import { useMarketingPageTitle } from '@/marketing/hooks/useMarketingPageTitle';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { TRUST_BULLETS } from '@/marketing/config/strategy';
import { formatPlanPrice, getPlanByCode } from '@/marketing/config/pricing';

export function BuyLicensePage() {
  const [searchParams] = useSearchParams();
  const planCode = searchParams.get('plan') ?? undefined;
  const plan = getPlanByCode(planCode);

  useMarketingPageTitle(
    'Acheter une licence Witnext',
    'Demandez un devis licence : Essentiel, Pro ou Entreprise. Web, desktop ou les deux.'
  );

  return (
    <div className="relative overflow-hidden min-h-[60vh]">
      <div className="absolute inset-0 marketing-hero-gradient pointer-events-none opacity-50" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <AnimateIn animation="fade-up" className="lg:pt-2">
            <p className="text-sm font-semibold marketing-brand-text uppercase tracking-wider mb-3">
              Licence
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Obtenez une proposition adaptée
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Indiquez utilisateurs, modules et déploiement (web / Windows). Notre équipe vous
              envoie un devis clair en dinars HT.
            </p>
            {plan && (
              <div className="mt-4 rounded-lg border border-border bg-card/80 px-4 py-3 text-sm">
                <p className="font-semibold">{plan.name}</p>
                <p className="text-muted-foreground mt-0.5">
                  {plan.monthlyPriceHt != null
                    ? `${formatPlanPrice(plan, 'monthly').primary}/mois · ${formatPlanPrice(plan, 'annual').primary}/an HT`
                    : 'Sur devis — à partir de 899 DT / mois'}
                </p>
              </div>
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
              Pas encore prêt ?{' '}
              <Link
                to={`/trial${planCode ? `?plan=${planCode}` : '?plan=pro'}`}
                className="marketing-brand-text font-medium hover:underline"
              >
                Demander un essai gratuit
              </Link>
            </p>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={80}>
            <LeadCaptureForm
              type="license"
              planCode={planCode}
              sourcePath="/buy"
              title="Demander un devis licence"
              subtitle="Utilisateurs, déploiement et modules — nous préparons votre proposition commerciale."
            />
          </AnimateIn>
        </div>
      </div>
    </div>
  );
}

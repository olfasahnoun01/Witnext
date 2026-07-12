import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PRICING_PLANS,
  PRICING_VAT_NOTE,
  type BillingCycle,
  annualSavingsLabel,
  formatPlanPrice,
} from '@/marketing/config/pricing';
import { BRAND_GREEN_TW } from '@/marketing/config/brand';
import { AnimateIn } from '@/marketing/components/AnimateIn';

type Props = {
  /** Compact layout for homepage teaser */
  compact?: boolean;
};

export function PricingCards({ compact = false }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  return (
    <div>
      <div className="flex flex-col items-center gap-3 mb-8 sm:mb-10">
        <div
          className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
          role="group"
          aria-label="Cycle de facturation"
        >
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              cycle === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              cycle === 'annual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Annuel
            <span className="ml-1.5 text-xs marketing-brand-text font-semibold">−2 mois</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{PRICING_VAT_NOTE}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PRICING_PLANS.map((plan, i) => {
          const price = formatPlanPrice(plan, cycle);
          const savings = cycle === 'annual' ? annualSavingsLabel(plan) : null;

          return (
            <AnimateIn key={plan.code} animation="fade-up" delay={i * 100} className="h-full">
              <div
                className={cn(
                  'relative flex flex-col h-full rounded-2xl border p-6 sm:p-8 transition-all duration-300',
                  plan.highlighted
                    ? `border-[hsl(${BRAND_GREEN_TW})/0.5] shadow-xl shadow-[hsl(${BRAND_GREEN_TW})/0.12] ring-1 ring-[hsl(${BRAND_GREEN_TW})/0.25] bg-[hsl(${BRAND_GREEN_TW})/0.04] scale-[1.02] lg:scale-105`
                    : `border-border bg-card hover:border-[hsl(${BRAND_GREEN_TW})/0.35] hover:shadow-lg`
                )}
              >
                {(plan.priceNote || savings) && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(${BRAND_GREEN_TW})] px-3 py-0.5 text-xs font-semibold text-white shadow-md whitespace-nowrap`}
                  >
                    {plan.priceNote ?? savings}
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 min-h-[40px] leading-relaxed">
                  {plan.tagline}
                </p>
                <div className="mt-4">
                  <p className="text-3xl sm:text-4xl font-black tracking-tight">{price.primary}</p>
                  {price.secondary && (
                    <p className="text-sm text-muted-foreground mt-1">{price.secondary}</p>
                  )}
                  {plan.highlighted && savings && plan.priceNote && (
                    <p className="text-xs marketing-brand-text font-medium mt-1">{savings}</p>
                  )}
                </div>
                {!compact && (
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 marketing-brand-text shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className={cn('flex flex-col gap-2', compact ? 'mt-6' : 'mt-8')}>
                  <Button
                    asChild
                    variant={plan.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'w-full',
                      plan.highlighted ? 'marketing-btn' : 'marketing-btn-outline'
                    )}
                  >
                    <Link to={`/trial?plan=${plan.code}`}>{plan.ctaTrial}</Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full marketing-btn-ghost">
                    <Link to={`/buy?plan=${plan.code}`}>{plan.ctaBuy}</Link>
                  </Button>
                </div>
              </div>
            </AnimateIn>
          );
        })}
      </div>
    </div>
  );
}

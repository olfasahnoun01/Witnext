import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PRICING_PLANS } from '@/marketing/config/pricing';
import { BRAND_GREEN_TW } from '@/marketing/config/brand';
import { AnimateIn } from '@/marketing/components/AnimateIn';

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {PRICING_PLANS.map((plan, i) => (
        <AnimateIn key={plan.code} animation="fade-up" delay={i * 100} className="h-full">
          <div
            className={cn(
              'relative flex flex-col h-full rounded-2xl border p-6 sm:p-8 transition-all duration-300',
              plan.highlighted
                ? `border-[hsl(${BRAND_GREEN_TW})/0.5] shadow-xl shadow-[hsl(${BRAND_GREEN_TW})/0.12] ring-1 ring-[hsl(${BRAND_GREEN_TW})/0.25] bg-[hsl(${BRAND_GREEN_TW})/0.04] scale-[1.02] lg:scale-105`
                : `border-border bg-card hover:border-[hsl(${BRAND_GREEN_TW})/0.35] hover:shadow-lg`
            )}
          >
            {plan.priceNote && (
              <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(${BRAND_GREEN_TW})] px-3 py-0.5 text-xs font-semibold text-white shadow-md`}>
                {plan.priceNote}
              </span>
            )}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 min-h-[40px] leading-relaxed">{plan.tagline}</p>
            <p className="text-3xl sm:text-4xl font-black mt-4">{plan.priceLabel}</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 marketing-brand-text shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-2">
              <Button
                asChild
                variant={plan.highlighted ? 'default' : 'outline'}
                className={cn('w-full', plan.highlighted ? 'marketing-btn' : 'marketing-btn-outline')}
              >
                <Link to={`/trial?plan=${plan.code}`}>Demander un essai</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full marketing-btn-ghost">
                <Link to={`/buy?plan=${plan.code}`}>Acheter une licence</Link>
              </Button>
            </div>
          </div>
        </AnimateIn>
      ))}
    </div>
  );
}

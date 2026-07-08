import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PRICING_PLANS } from '@/marketing/config/pricing';

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PRICING_PLANS.map((plan) => (
        <div
          key={plan.code}
          className={cn(
            'relative flex flex-col rounded-2xl border p-6 shadow-sm',
            plan.highlighted
              ? 'border-primary shadow-lg ring-1 ring-primary/20 bg-primary/[0.02]'
              : 'border-border bg-card'
          )}
        >
          {plan.priceNote && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
              {plan.priceNote}
            </span>
          )}
          <h3 className="text-xl font-bold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{plan.tagline}</p>
          <p className="text-3xl font-black mt-4">{plan.priceLabel}</p>
          <ul className="mt-6 space-y-2 flex-1">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild variant={plan.highlighted ? 'default' : 'outline'} className="w-full">
              <Link to={`/trial?plan=${plan.code}`}>Demander un essai</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to={`/buy?plan=${plan.code}`}>Acheter une licence</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

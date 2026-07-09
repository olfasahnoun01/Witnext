import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { isTrialActive, trialDaysRemaining } from '@/lib/tenantTypes';

export function TrialBanner() {
  const { tenant } = useTenant();

  const message = useMemo(() => {
    if (!tenant || !isTrialActive(tenant)) return null;
    const days = trialDaysRemaining(tenant);
    if (days === null) return 'Vous êtes en période d’essai Witnext.';
    if (days <= 0) return 'Votre essai Witnext est terminé. Contactez-nous pour activer un abonnement.';
    if (days === 1) return 'Il reste 1 jour sur votre essai Witnext.';
    return `Il reste ${days} jours sur votre essai Witnext.`;
  }, [tenant]);

  if (!message) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-center text-sm text-foreground">
      <span className="inline-flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        {message}
      </span>
    </div>
  );
}

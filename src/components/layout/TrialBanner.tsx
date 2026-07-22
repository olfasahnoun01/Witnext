import { useMemo } from 'react';
import { CreditCard, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import {
  canViewTenantBilling,
  isTrialActive,
  licenseDaysRemaining,
  trialDaysRemaining,
} from '@/lib/tenantTypes';
import { getPathForSubsection } from '@/config/routes';

export function TrialBanner() {
  const { tenant } = useTenant();
  const billingPath = getPathForSubsection('tenant-billing');

  const content = useMemo(() => {
    if (!tenant) return null;

    if (isTrialActive(tenant)) {
      const days = trialDaysRemaining(tenant);
      let text = 'Vous êtes en période d’essai Witnext.';
      if (days === 0) {
        text = 'Votre essai Witnext est terminé. Contactez-nous pour activer un abonnement.';
      } else if (days === 1) {
        text = 'Il reste 1 jour sur votre essai Witnext.';
      } else if (days != null && days > 1) {
        text = `Il reste ${days} jours sur votre essai Witnext.`;
      }
      return { icon: 'trial' as const, text, showBillingLink: canViewTenantBilling(tenant) };
    }

    if (tenant.plan !== 'trial' && tenant.licenseEndsAt) {
      const days = licenseDaysRemaining(tenant);
      if (days === null) return null;
      if (days <= 0) {
        return {
          icon: 'license' as const,
          text: 'Votre licence Witnext a expiré. Renouvelez pour continuer.',
          showBillingLink: canViewTenantBilling(tenant),
        };
      }
      if (days <= 14) {
        return {
          icon: 'license' as const,
          text:
            days === 1
              ? 'Votre licence Witnext expire demain.'
              : `Votre licence Witnext expire dans ${days} jours.`,
          showBillingLink: canViewTenantBilling(tenant),
        };
      }
    }

    return null;
  }, [tenant]);

  if (!content) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-center text-sm text-foreground">
      <span className="inline-flex flex-wrap items-center justify-center gap-2 font-medium">
        {content.icon === 'trial' ? (
          <Sparkles className="h-4 w-4 text-primary" />
        ) : (
          <CreditCard className="h-4 w-4 text-primary" />
        )}
        {content.text}
        {content.showBillingLink ? (
          <Link to={billingPath} className="underline underline-offset-2 hover:text-primary">
            Voir facturation
          </Link>
        ) : null}
      </span>
    </div>
  );
}

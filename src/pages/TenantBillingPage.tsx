import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Download, Loader2, Receipt } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { fetchMyBillingReceipts } from '@/lib/tenantService';
import {
  canViewTenantBilling,
  licenseDaysRemaining,
  licenseEndDate,
  TENANT_BILLING_CYCLE_LABELS,
  TENANT_PLAN_LABELS,
  type TenantBillingReceipt,
} from '@/lib/tenantTypes';
import { formatAppDate } from '@/lib/formatAppDate';
import { downloadTenantBillingReceiptPDF } from '@/utils/tenantBillingReceiptPdf';
import { AccessDenied } from '@/router/RouteGuards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function TenantBillingPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<TenantBillingReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  const allowed = canViewTenantBilling(tenant);

  const loadReceipts = useCallback(async () => {
    if (!allowed) {
      setReceipts([]);
      setLoadingReceipts(false);
      return;
    }
    setLoadingReceipts(true);
    const result = await fetchMyBillingReceipts();
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error ?? 'Impossible de charger les reçus.',
      });
      setReceipts([]);
    } else {
      setReceipts(result.receipts);
    }
    setLoadingReceipts(false);
  }, [allowed, toast]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed || !tenant) {
    return <AccessDenied />;
  }

  const endDate = licenseEndDate(tenant);
  const daysLeft = licenseDaysRemaining(tenant);
  const isTrial = tenant.plan === 'trial';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Facturation & licence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Abonnement Witnext de votre organisation — dates, offre et reçus téléchargeables.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Organisation
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nom</p>
            <p className="font-medium">{tenant.tenantName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Référence</p>
            <p className="font-mono text-sm">{tenant.slug}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Offre</p>
            <p className="font-medium flex items-center gap-2">
              {TENANT_PLAN_LABELS[tenant.plan]}
              <Badge variant={tenant.status === 'active' ? 'default' : 'destructive'}>
                {tenant.status === 'active'
                  ? 'Actif'
                  : tenant.status === 'suspended'
                    ? 'Suspendu'
                    : 'Annulé'}
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cycle</p>
            <p className="font-medium">
              {tenant.billingCycle
                ? TENANT_BILLING_CYCLE_LABELS[tenant.billingCycle]
                : isTrial
                  ? 'Essai'
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {isTrial ? 'Fin d’essai' : 'Fin de licence'}
            </p>
            <p className="font-medium">
              {endDate ? formatAppDate(endDate) : 'Non définie'}
            </p>
            {daysLeft !== null && (
              <p
                className={`text-xs mt-1 ${
                  daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                }`}
              >
                {daysLeft <= 0
                  ? 'Période expirée — contactez Witnext pour renouveler.'
                  : daysLeft === 1
                    ? '1 jour restant'
                    : `${daysLeft} jours restants`}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Début de période</p>
            <p className="font-medium">
              {tenant.licenseStartsAt
                ? formatAppDate(tenant.licenseStartsAt)
                : isTrial
                  ? '—'
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Utilisateurs</p>
            <p className="font-medium">Jusqu’à {tenant.maxUsers}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sociétés</p>
            <p className="font-medium">Jusqu’à {tenant.maxCompanies}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Reçus de licence</h2>
        </div>
        {loadingReceipts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {isTrial
              ? 'Aucun reçu pour le moment — votre organisation est en période d’essai.'
              : 'Aucun reçu émis pour l’instant. Les reçus apparaissent ici après activation ou renouvellement par Witnext.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Offre</th>
                  <th className="px-4 py-3 font-medium">Période</th>
                  <th className="px-4 py-3 font-medium">Montant HT</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.numero}</td>
                    <td className="px-4 py-3">{formatAppDate(r.issuedAt)}</td>
                    <td className="px-4 py-3">{TENANT_PLAN_LABELS[r.plan]}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.periodStart && r.periodEnd
                        ? `${formatAppDate(r.periodStart)} → ${formatAppDate(r.periodEnd)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.amountHt.toFixed(3)} {r.currency}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => downloadTenantBillingReceiptPDF(tenant, r)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

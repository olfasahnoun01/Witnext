import { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  FileText,
  Truck,
  Fuel,
  Wallet,
  Users,
  Building2,
  Loader2,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { useAppCompany, useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import {
  fetchExecutiveDashboardSummary,
  type ExecutiveDashboardSummary,
} from '@/services/executiveDashboardService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function formatTnd(value: number) {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;
}

const MetricCard = memo(({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  href?: string;
}) => {
  const content = (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 h-full transition-shadow hover:shadow-md',
        variant === 'primary' && 'border-primary/30 bg-primary/[0.03]',
        variant === 'success' && 'border-success/30',
        variant === 'warning' && 'border-warning/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div
          className={cn(
            'p-2.5 rounded-lg shrink-0',
            variant === 'primary' ? 'bg-primary/10 text-primary' :
            variant === 'success' ? 'bg-success/10 text-success' :
            variant === 'warning' ? 'bg-warning/10 text-warning' :
            'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {href && (
        <p className="text-xs text-primary mt-3 inline-flex items-center gap-1">
          Voir détail <ArrowRight className="h-3 w-3" />
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link to={href} className="block h-full">{content}</Link>;
  }
  return content;
});

MetricCard.displayName = 'MetricCard';

export const ExecutiveDashboard = memo(() => {
  const { currentCompanyId, loading: companyLoading } = useAppCompany();
  const [summary, setSummary] = useState<ExecutiveDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveDashboardSummary(currentCompanyId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (!companyLoading && currentCompanyId) void load();
  }, [companyLoading, currentCompanyId, load]);

  useSessionResumeReload(load);
  useCompanyChangeReload(load);

  if (companyLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement de la vue direction…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (!summary) return null;

  const periodLabel = `${MONTH_NAMES[summary.mois - 1]} ${summary.annee}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Vue direction</p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Tableau de bord global</h2>
          <p className="text-sm text-muted-foreground mt-1">Synthèse {periodLabel}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/reports">
            Rapports & analyses
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="CA mensuel (HT)"
          value={formatTnd(summary.chiffreAffairesHt)}
          subtitle={`TTC : ${formatTnd(summary.chiffreAffairesTtc)}`}
          icon={TrendingUp}
          variant="primary"
          href="/finance"
        />
        <MetricCard
          title="Encours clients"
          value={formatTnd(summary.encoursClients)}
          subtitle="Reste à encaisser"
          icon={Users}
          href="/reports"
        />
        <MetricCard
          title="Encours fournisseurs"
          value={formatTnd(summary.encoursFournisseurs)}
          subtitle="Reste à payer"
          icon={Building2}
          href="/reports"
        />
        <MetricCard
          title="Charges du mois"
          value={formatTnd(summary.expenses.totalChargesMois)}
          subtitle="Carburant, paie, maintenance, paiements"
          icon={Wallet}
          variant="warning"
          href="/reports"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Activité commerciale
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{summary.commercial.devisEnCours}</p>
              <p className="text-[10px] text-muted-foreground">Devis en cours</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Receipt className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{summary.commercial.commandesOuvertes}</p>
              <p className="text-[10px] text-muted-foreground">Commandes</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Truck className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{summary.commercial.bonsLivraison}</p>
              <p className="text-[10px] text-muted-foreground">Bons de livraison</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Pipeline devis : <strong className="text-foreground">{formatTnd(summary.commercial.devisMontant)}</strong></span>
            <span>Commandes : <strong className="text-foreground">{formatTnd(summary.commercial.commandesMontant)}</strong></span>
          </div>
          <Button asChild variant="link" className="px-0 mt-2 h-auto">
            <Link to="/sales/orders">Voir les ventes →</Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Fuel className="h-4 w-4 text-warning" />
            Charges & dépenses ({periodLabel})
          </h3>
          <div className="space-y-2">
            {summary.expenses.breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune charge enregistrée ce mois</p>
            ) : (
              summary.expenses.breakdown.map((item) => (
                <div
                  key={item.key}
                  className="flex justify-between items-center py-2 border-b border-border/60 last:border-0"
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="font-semibold tabular-nums">{formatTnd(item.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between items-center pt-3 mt-2 border-t border-border">
              <span className="text-sm font-semibold">Total charges payées</span>
              <span className="font-bold text-warning tabular-nums">
                {formatTnd(summary.expenses.totalChargesMois)}
              </span>
            </div>
            {summary.expenses.facturesAchatsMois > 0 &&
              !summary.expenses.breakdown.some((b) => b.key === 'achats') && (
              <p className="text-xs text-muted-foreground pt-1">
                Factures achats engagées : {formatTnd(summary.expenses.facturesAchatsMois)}
              </p>
            )}
          </div>
          <Button asChild variant="link" className="px-0 mt-2 h-auto">
            <Link to="/finance">Trésorerie & finance →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
});

ExecutiveDashboard.displayName = 'ExecutiveDashboard';

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FluxDossierDetail } from '../types/dossierTypes';
import {
  buildFluxDashboardAlerts,
  computeFluxDashboardSummary,
  type FluxDashboardAlert,
} from '../services/fluxDashboard';

interface FluxDashboardProps {
  dossiers: FluxDossierDetail[];
  loading: boolean;
  onSelectDossier: (id: string) => void;
  onGoToList: (tab?: 'incomplets' | 'en_cours') => void;
}

export function FluxDashboard({ dossiers, loading, onSelectDossier, onGoToList }: FluxDashboardProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = computeFluxDashboardSummary(dossiers);
  const alerts = buildFluxDashboardAlerts(dossiers);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dossiers actifs"
          value={summary.total}
          icon={Clock}
          tone="neutral"
          onClick={() => onGoToList('en_cours')}
        />
        <StatCard
          label="Alertes"
          value={summary.alertCount}
          icon={AlertTriangle}
          tone="danger"
          highlight={summary.alertCount > 0}
          onClick={() => onGoToList('incomplets')}
        />
        <StatCard
          label="En cours"
          value={summary.inProgress}
          icon={Clock}
          tone="info"
          onClick={() => onGoToList('en_cours')}
        />
        <StatCard
          label="Terminés"
          value={summary.complete}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <Card className="border-amber-200/60 dark:border-amber-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Alertes — pièces manquantes ou processus incomplet
              </CardTitle>
              <CardDescription className="mt-1">
                Par client ou fournisseur : documents non créés, non validés ou étapes bloquées.
              </CardDescription>
            </div>
            {alerts.length > 0 && (
              <Badge variant="destructive" className="shrink-0 tabular-nums">
                {alerts.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 px-4 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600/70 mb-3" />
              <p className="font-medium text-foreground">Aucune alerte ouverte</p>
              <p className="text-sm mt-1">
                Tous les dossiers suivis sont à jour, ou importez vos devis pour démarrer le suivi.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertRow key={alert.dossierId} alert={alert} onSelect={() => onSelectDossier(alert.dossierId)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  highlight,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: 'neutral' | 'danger' | 'info' | 'success';
  highlight?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    neutral: 'border-border',
    danger: 'border-red-200 dark:border-red-900/50',
    info: 'border-blue-200 dark:border-blue-900/50',
    success: 'border-green-200 dark:border-green-900/50',
  }[tone];

  const iconClass = {
    neutral: 'text-muted-foreground',
    danger: 'text-red-600',
    info: 'text-blue-600',
    success: 'text-green-600',
  }[tone];

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 text-left transition-colors',
        toneClass,
        highlight && 'ring-2 ring-red-500/30',
        onClick && 'hover:bg-muted/40 cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0', iconClass)} />
      </div>
      <p className="text-3xl font-bold tabular-nums mt-2">{value}</p>
    </Wrapper>
  );
}

function AlertRow({ alert, onSelect }: { alert: FluxDashboardAlert; onSelect: () => void }) {
  const isFournisseur = alert.partyKind === 'fournisseur' || alert.direction === 'achat';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 hover:bg-amber-50 dark:hover:bg-amber-950/35 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isFournisseur ? (
              <Badge variant="outline" className="gap-1 text-[10px] border-orange-300 text-orange-800">
                <Truck className="h-3 w-3" /> Fournisseur
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 text-emerald-800">
                <Building2 className="h-3 w-3" /> Client
              </Badge>
            )}
            <span className="font-semibold text-foreground truncate">{alert.partyName}</span>
            <span className="text-xs font-mono text-muted-foreground">{alert.dossierNumber}</span>
          </div>

          {(alert.bcReference || alert.devisReference) && (
            <p className="text-xs text-muted-foreground mt-1">
              {[alert.devisReference && `Devis ${alert.devisReference}`, alert.bcReference && `BC ${alert.bcReference}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {alert.nextActionLabel && (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mt-2">
              {alert.nextActionLabel}
            </p>
          )}

          <ul className="mt-2 space-y-0.5">
            {alert.missingLabels.map((label) => (
              <li key={label} className="text-sm text-amber-900/90 dark:text-amber-100/90 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-600 shrink-0" />
                {label} — manquant ou non validé
              </li>
            ))}
          </ul>

          {alert.missingChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {alert.missingChips.map((c) => (
                <Badge key={c} variant="destructive" className="text-[10px] font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 max-w-xs">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${alert.completionPercent}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{alert.completionPercent}%</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Landmark, PiggyBank, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatMontantDt } from '../../lib/money';
import { loadTreasuryAccounts } from '../../services/treasuryStorage';
import { syncTreasuryBalancesFromMovements } from '../../services/treasurySyncApi';
import type { TreasuryAccount } from '../../types/financeDomain';
import type { TreasuryAccountType } from '../../types/financeDomain';
import { InterAccountTransferDialog } from './InterAccountTransferDialog';
import { TreasuryAccountFormDialog } from './TreasuryAccountFormDialog';

interface TreasuryAccountsDashboardProps {
  companyId: string;
  /** Filtre par type de compte ; omit = tous les comptes. */
  filterTypes?: TreasuryAccountType[];
  title?: string;
  description?: string;
  showTransferButton?: boolean;
  showNewAccountButton?: boolean;
  newAccountDefaultType?: TreasuryAccountType;
}

function accountIcon(type: TreasuryAccount['type']) {
  if (type === 'CAISSE') return PiggyBank;
  return Landmark;
}

/**
 * Tableau de bord des comptes banque / caisse — soldes et virements.
 */
export function TreasuryAccountsDashboard({
  companyId,
  filterTypes,
  title = 'Comptes de trésorerie',
  description,
  showTransferButton = true,
  showNewAccountButton = true,
  newAccountDefaultType = 'BANQUE',
}: TreasuryAccountsDashboardProps) {
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);

  useEffect(() => {
    let active = true;
    loadTreasuryAccounts(companyId)
      .then((rows) => {
        if (active) setAccounts(rows);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Chargement des comptes impossible'));
    return () => {
      active = false;
    };
  }, [companyId]);

  const visibleAccounts = filterTypes
    ? accounts.filter((a) => filterTypes.includes(a.type))
    : accounts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-2">
          {showTransferButton && (
            <Button variant="outline" className="gap-2" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              Virement inter-comptes
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const synced = await syncTreasuryBalancesFromMovements(companyId);
                setAccounts(synced);
                toast.success('Soldes recalculés depuis les mouvements');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Sync impossible');
              }
            }}
          >
            Sync mouvements
          </Button>
          {showNewAccountButton && (
            <Button variant="secondary" className="gap-2" onClick={() => setAccountFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouveau compte
            </Button>
          )}
        </div>
      </div>

      {visibleAccounts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
          Aucun compte dans cette catégorie. Créez un compte ou modifiez le filtre.
        </p>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleAccounts.map((acc) => {
          const Icon = accountIcon(acc.type);
          const positif = acc.soldeActuel >= 0;
          const alerteCaisse = acc.type === 'CAISSE' && acc.soldeActuel < 0;
          return (
            <Card
              key={acc.id}
              className={cn(
                'overflow-hidden transition-shadow hover:shadow-md',
                alerteCaisse && 'border-destructive ring-1 ring-destructive/40'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight">{acc.nom}</CardTitle>
                      <CardDescription className="font-mono text-xs">{acc.codeComptable}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline">{acc.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {acc.rib && (
                  <p className="text-xs text-muted-foreground font-mono break-all">RIB : {acc.rib}</p>
                )}
                {acc.banqueLabel && (
                  <p className="text-xs text-muted-foreground">{acc.banqueLabel}</p>
                )}
                <div
                  className={cn(
                    'rounded-lg px-3 py-3 text-center',
                    positif ? 'bg-emerald-500/10' : 'bg-destructive/10'
                  )}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Solde actuel</p>
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      positif ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                    )}
                  >
                    {formatMontantDt(acc.soldeActuel)}
                  </p>
                </div>
                {alerteCaisse && (
                  <p className="text-xs text-destructive font-medium text-center">
                    Fonds insuffisants en caisse
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {showTransferButton && (
      <InterAccountTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        companyId={companyId}
        accounts={accounts}
        onSuccess={(updated) => setAccounts(updated)}
      />
      )}
      {showNewAccountButton && (
      <TreasuryAccountFormDialog
        open={accountFormOpen}
        onOpenChange={setAccountFormOpen}
        companyId={companyId}
        defaultType={newAccountDefaultType}
        onSaved={setAccounts}
      />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Landmark, PiggyBank, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMontantDt } from '../../lib/money';
import { FinanceAmount } from '../shared/FinanceAmount';
import { loadTreasuryAccounts } from '../../services/treasuryStorage';
import type { TreasuryAccount } from '../../types/financeDomain';
import {
  FinanceSectionHeader,
  FinanceSubNav,
} from '../layout/FinanceSubNav';
import { getTreasurySubsections } from '../../lib/financeNavigation';
import { TreasuryAccountsDashboard } from './TreasuryAccountsDashboard';
import { BankReconciliationPanel } from './BankReconciliationPanel';
import { InterAccountTransferDialog } from './InterAccountTransferDialog';
import { TraitesPortfolioPanel } from '../traites/TraitesPortfolioPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BankFeesPanel } from './BankFeesPanel';
import { TreasuryUnpaidPanel } from './TreasuryUnpaidPanel';
import type { PaymentRow } from '../../types';
import { cn } from '@/lib/utils';

interface TreasuryHubPanelProps {
  companyId: string;
  clientPaymentsTotal: number;
  payments: PaymentRow[];
}

export function TreasuryHubPanel({ companyId, clientPaymentsTotal, payments }: TreasuryHubPanelProps) {
  const subsections = useMemo(() => getTreasurySubsections(), []);
  const [activeSub, setActiveSub] = useState('bank');
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);

  const refreshAccounts = useCallback(() => {
    loadTreasuryAccounts(companyId)
      .then(setAccounts)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Chargement des comptes impossible'));
  }, [companyId]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return (
    <div className="space-y-4">
      <FinanceSectionHeader title="Trésorerie" />

      <FinanceSubNav items={subsections} value={activeSub} onValueChange={setActiveSub} />

      {activeSub === 'bank' && (
        <div className="space-y-8">
          <TreasuryAccountsDashboard
            companyId={companyId}
            filterTypes={['BANQUE']}
            title="Comptes banque"
            showTransferButton={false}
            newAccountDefaultType="BANQUE"
          />
          <BankFeesPanel companyId={companyId} />
        </div>
      )}

      {activeSub === 'bank-fees' && <BankFeesPanel companyId={companyId} />}

      {activeSub === 'unpaid' && (
        <TreasuryUnpaidPanel companyId={companyId} payments={payments} />
      )}

      {activeSub === 'bank-recon' && <BankReconciliationPanel companyId={companyId} />}

      {activeSub === 'cash' && (
        <TreasuryAccountsDashboard
          companyId={companyId}
          filterTypes={['CAISSE']}
          title="Comptes caisse"
          showTransferButton={false}
          newAccountDefaultType="CAISSE"
        />
      )}

      {activeSub === 'effects' && (
        <div className="space-y-8">
          <TreasuryAccountsDashboard
            companyId={companyId}
            filterTypes={['ATTENTE_EFFETS']}
            title="Compte d'attente effets"
            showTransferButton={false}
            showNewAccountButton={false}
          />
          <TraitesPortfolioPanel companyId={companyId} />
        </div>
      )}

      {activeSub === 'transfers' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Virements inter-comptes</h3>
              <p className="text-sm text-muted-foreground">
                Transférez des fonds entre banque, caisse et autres comptes actifs.
              </p>
            </div>
            <Button className="gap-2" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              Nouveau virement
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts
              .filter((a) => a.actif && a.type !== 'ATTENTE_EFFETS')
              .map((acc) => (
                <CompactAccountCard key={acc.id} account={acc} />
              ))}
          </div>
          <InterAccountTransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            companyId={companyId}
            accounts={accounts}
            onSuccess={(updated) => setAccounts(updated)}
          />
        </div>
      )}

      {activeSub === 'summary' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Total banque"
              icon={Landmark}
              amount={sumByType(accounts, 'BANQUE')}
              variant="bank"
            />
            <SummaryCard
              label="Total caisse"
              icon={PiggyBank}
              amount={sumByType(accounts, 'CAISSE')}
              variant="cash"
            />
            <SummaryCard
              label="Effets en attente"
              icon={Wallet}
              amount={sumByType(accounts, 'ATTENTE_EFFETS')}
              variant="effects"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Synthèse trésorerie</CardTitle>
              <CardDescription>Encaissements clients cumulés (module règlements)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-bold tabular-nums">
                <FinanceAmount amount={clientPaymentsTotal} kind="income" className="text-2xl" />
              </p>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Compte</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-left p-2 font-medium">PCG</th>
                      <th className="text-right p-2 font-medium">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.filter((a) => a.actif).map((acc) => (
                      <tr key={acc.id} className="border-b last:border-0">
                        <td className="p-2">{acc.nom}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {acc.type}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono text-xs">{acc.codeComptable}</td>
                        <td className="p-2 text-right tabular-nums font-medium">
                          {formatMontantDt(acc.soldeActuel)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={refreshAccounts}>
                Actualiser les soldes
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function sumByType(accounts: TreasuryAccount[], type: TreasuryAccount['type']): number {
  return accounts.filter((a) => a.actif && a.type === type).reduce((s, a) => s + a.soldeActuel, 0);
}

function CompactAccountCard({ account }: { account: TreasuryAccount }) {
  const Icon = account.type === 'CAISSE' ? PiggyBank : Landmark;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">{account.nom}</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs">{account.codeComptable}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-bold tabular-nums">{formatMontantDt(account.soldeActuel)}</p>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  icon: Icon,
  amount,
  variant,
}: {
  label: string;
  icon: typeof Landmark;
  amount: number;
  variant: 'bank' | 'cash' | 'effects';
}) {
  return (
    <Card className={cn(variant === 'cash' && amount < 0 && 'border-destructive')}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">
          <FinanceAmount amount={amount} kind="income" className="text-2xl" />
        </p>
      </CardContent>
    </Card>
  );
}

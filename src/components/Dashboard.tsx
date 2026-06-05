import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { getDashboardStats, getRecentTransactions } from '@/services/dbService';
import { DashboardStats, Transaction } from '@/types';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useProductGroupCategoryStats } from '@/hooks/useProductGroupCategoryStats';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { waitForSupabaseSession } from '@/lib/waitForSupabaseSession';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { InventoryCategoryChartsCards } from '@/components/inventory/InventoryCategoryChartsCards';

// Memoized KPI Card component
const KPICard = memo(({ 
  title, 
  value, 
  icon: Icon, 
  variant, 
  change, 
  positive, 
  delay 
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  variant: 'primary' | 'success' | 'warning' | 'danger';
  change: string;
  positive: boolean;
  delay: number;
}) => (
  <div
    className={`kpi-card kpi-card-${variant} bg-card border border-border`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        <div className="flex items-center gap-1 mt-2">
          {positive ? (
            <ArrowUpRight className="w-4 h-4 text-success" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-destructive" />
          )}
          <span className={`text-xs font-medium ${positive ? 'text-success' : 'text-destructive'}`}>
            {change}
          </span>
        </div>
      </div>
      <div className={`p-3 rounded-xl ${
        variant === 'primary' ? 'bg-primary/10' :
        variant === 'success' ? 'bg-success/10' :
        variant === 'warning' ? 'bg-warning/10' : 'bg-destructive/10'
      }`}>
        <Icon className={`w-6 h-6 ${
          variant === 'primary' ? 'text-primary' :
          variant === 'success' ? 'text-success' :
          variant === 'warning' ? 'text-warning' : 'text-destructive'
        }`} />
      </div>
    </div>
  </div>
));

KPICard.displayName = 'KPICard';

// Memoized Transaction Item
const TransactionItem = memo(({ tx }: { tx: Transaction }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
    <div className={`p-2 rounded-lg ${
      tx.type === 'IN' ? 'bg-success/10' : 'bg-destructive/10'
    }`}>
      {tx.type === 'IN' ? (
        <ArrowDownRight className="w-4 h-4 text-success" />
      ) : (
        <ArrowUpRight className="w-4 h-4 text-destructive" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">
        {tx.product_name}
      </p>
      <p className="text-xs text-muted-foreground">
        {tx.type === 'IN' ? 'Entrée' : 'Sortie'}: {tx.quantity} unités
      </p>
      {tx.note && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {tx.note}
        </p>
      )}
    </div>
  </div>
));

TransactionItem.displayName = 'TransactionItem';

export const Dashboard = memo(() => {
  const { user, isLoading: authLoading } = useAuth();
  const {
    isLoading: categoryChartsLoading,
    inventoryChartBarRows,
    inventoryChartPieRows,
    totalProducts: categoryGroupTotal,
  } = useProductGroupCategoryStats();

  const [stats, setStats] = useState<DashboardStats>({
    totalValue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categoryValues: []
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const loadData = useCallback(async () => {
    try {
      const ready = await waitForSupabaseSession();
      if (!ready) return;

      const [statsData, transactionsData] = await Promise.all([
        getDashboardStats(),
        getRecentTransactions(8),
      ]);
      setStats(statsData);
      setRecentTransactions(transactionsData);
    } catch (err) {
      console.error('[Dashboard] loadData failed:', err);
    }
  }, []);

  // Load KPI / activity after auth (category charts load in useProductGroupCategoryStats)
  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;

    const run = async () => {
      if (!cancelled) await loadData();
    };

    void run();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled || event !== 'SIGNED_IN' || !nextSession?.user?.id) return;
      void run();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [authLoading, user?.id, loadData]);

  useSessionResumeReload(loadData);

  // Subscribe to realtime updates
  useRealtimeData({
    tables: ['products', 'transactions'],
    onDataChange: loadData,
    showToast: false,
  });

  // Memoized KPI cards configuration
  const kpiCards = useMemo(() => [
    {
      title: 'Valeur Totale',
      value: `${stats.totalValue.toFixed(3)} TND`,
      icon: TrendingUp,
      variant: 'primary' as const,
      change: '+12.5%',
      positive: true
    },
    {
      title: 'Total Produits',
      value: stats.totalProducts.toString(),
      icon: Package,
      variant: 'success' as const,
      change: '+3',
      positive: true
    },
    {
      title: 'Stock Faible',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      variant: 'warning' as const,
      change: stats.lowStockCount > 0 ? 'Attention' : 'OK',
      positive: stats.lowStockCount === 0
    },
    {
      title: 'Rupture Stock',
      value: stats.outOfStockCount.toString(),
      icon: XCircle,
      variant: 'danger' as const,
      change: stats.outOfStockCount > 0 ? 'Urgent' : 'OK',
      positive: stats.outOfStockCount === 0
    }
  ], [stats]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, index) => (
          <KPICard
            key={card.title}
            {...card}
            delay={index * 100}
          />
        ))}
      </div>

      {/* Charts (inventaire par catégorie) + activité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-lg font-semibold text-foreground px-1">
            Inventaire par catégorie
            {categoryGroupTotal > 0 && (
              <span className="text-sm font-normal text-muted-foreground ms-2">
                ({categoryGroupTotal} groupe{categoryGroupTotal !== 1 ? 's' : ''})
              </span>
            )}
          </h3>
          <InventoryCategoryChartsCards
            barRows={inventoryChartBarRows}
            pieRows={inventoryChartPieRows}
            isLoading={categoryChartsLoading}
          />
          {!categoryChartsLoading && categoryGroupTotal === 0 && (
            <p className="text-sm text-muted-foreground px-1 py-6 text-center rounded-xl border border-dashed border-border bg-muted/30">
              Aucun groupe produit — les graphiques apparaîtront lorsque l&apos;inventaire contiendra des articles.
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Activité Récente</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune activité récente
              </p>
            ) : (
              recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

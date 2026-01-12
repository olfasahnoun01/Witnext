import { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  XCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getDashboardStats, getRecentTransactions } from '@/services/dbService';
import { DashboardStats, Transaction } from '@/types';
import { useRealtimeData } from '@/hooks/useRealtimeData';

const CHART_COLORS = ['hsl(217, 91%, 50%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalValue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categoryValues: []
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const loadData = useCallback(async () => {
    const [statsData, transactionsData] = await Promise.all([
      getDashboardStats(),
      getRecentTransactions(8)
    ]);
    setStats(statsData);
    setRecentTransactions(transactionsData);
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to realtime updates
  useRealtimeData({
    tables: ['products', 'transactions'],
    onDataChange: loadData,
  });

  const kpiCards = [
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
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, index) => (
          <div
            key={card.title}
            className={`kpi-card kpi-card-${card.variant} bg-card border border-border`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {card.positive ? (
                    <ArrowUpRight className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  )}
                  <span className={`text-xs font-medium ${card.positive ? 'text-success' : 'text-destructive'}`}>
                    {card.change}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                card.variant === 'primary' ? 'bg-primary/10' :
                card.variant === 'success' ? 'bg-success/10' :
                card.variant === 'warning' ? 'bg-warning/10' : 'bg-destructive/10'
              }`}>
                <card.icon className={`w-6 h-6 ${
                  card.variant === 'primary' ? 'text-primary' :
                  card.variant === 'success' ? 'text-success' :
                  card.variant === 'warning' ? 'text-warning' : 'text-destructive'
                }`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Valeur Stock par Catégorie</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.categoryValues} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)} TND`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="category" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(3)} TND`, 'Valeur']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {stats.categoryValues.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                <div
                  key={tx.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

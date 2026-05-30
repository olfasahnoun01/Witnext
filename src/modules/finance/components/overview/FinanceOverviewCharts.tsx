import { useMemo } from 'react';
import { Activity, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMontantDt } from '../../lib/money';
import {
  buildMonthlyTradingSeries,
  buildPaymentsDonut,
  buildRevenueExpenseDonut,
  buildSalesStatusDonut,
  type DonutSlice,
} from '../../lib/financeOverviewStats';
import type { InvoiceRow, PaymentRow } from '../../types';
import { FinanceAmount } from '../shared/FinanceAmount';

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
};

interface FinanceOverviewChartsProps {
  saleInvoices: InvoiceRow[];
  purchaseInvoices: InvoiceRow[];
  payments: PaymentRow[];
  showPurchases: boolean;
  loading: boolean;
}

function DonutCard({
  title,
  description,
  data,
  centerLabel,
  centerValue,
}: {
  title: string;
  description: string;
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[min(340px,45vh)] min-h-[280px] relative">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Aucune donnée sur la période
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={68}
                  outerRadius={102}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatMontantDt(v), '']}
                  {...chartTooltipStyle}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--foreground))' }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            {centerLabel && centerValue && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>
                <span className="text-sm font-bold tabular-nums">{centerValue}</span>
              </div>
            )}
          </>
        )}
        {total > 0 && !centerValue && (
          <p className="text-center text-xs text-muted-foreground -mt-2 tabular-nums">
            Total : {formatMontantDt(total)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Chandelier simplifié (corps vert/rouge selon net mensuel). */
function TradingCandleShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { net: number; open: number; close: number };
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;

  const bullish = payload.net >= 0;
  const color = bullish ? 'hsl(142, 71%, 42%)' : 'hsl(0, 72%, 55%)';
  const bodyH = Math.max(Math.abs(height), 4);
  const bodyY = height >= 0 ? y : y + height;

  return (
    <g>
      <rect
        x={x + width * 0.25}
        y={bodyY}
        width={width * 0.5}
        height={bodyH}
        fill={color}
        rx={2}
        opacity={0.9}
      />
    </g>
  );
}

export function FinanceOverviewCharts({
  saleInvoices,
  purchaseInvoices,
  payments,
  showPurchases,
  loading,
}: FinanceOverviewChartsProps) {
  const salesStatusDonut = useMemo(() => buildSalesStatusDonut(saleInvoices), [saleInvoices]);
  const revenueExpenseDonut = useMemo(
    () => buildRevenueExpenseDonut(saleInvoices, purchaseInvoices),
    [saleInvoices, purchaseInvoices]
  );
  const paymentsDonut = useMemo(() => buildPaymentsDonut(payments), [payments]);
  const tradingSeries = useMemo(() => buildMonthlyTradingSeries(payments, 12), [payments]);

  const latestNet = tradingSeries.at(-1)?.close ?? 0;
  const prevNet = tradingSeries.at(-2)?.close ?? 0;
  const netDelta = latestNet - prevNet;
  const netTrendUp = netDelta >= 0;

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((k) => (
          <Card key={k} className="min-h-[320px] animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trading-style chart — full width */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Flux trésorerie — 12 mois
              </CardTitle>
              <CardDescription>
                Encaissements, décaissements et position nette cumulative (style trading)
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Position nette</p>
              <FinanceAmount
                amount={latestNet}
                kind={latestNet >= 0 ? 'income' : 'charge'}
                className="text-xl"
              />
              <p className={netTrendUp ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>
                {netTrendUp ? '▲' : '▼'} {formatMontantDt(Math.abs(netDelta))} vs mois préc.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 h-[min(420px,55vh)] min-h-[320px]">
          {tradingSeries.every((p) => p.encaissements === 0 && p.decaissements === 0) ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Aucun règlement enregistré — les courbes apparaîtront après les premiers encaissements.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tradingSeries} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="financeAreaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 71%, 42%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(142, 71%, 42%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="financeAreaRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  yAxisId="flow"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="pos"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [formatMontantDt(v), name]}
                  labelFormatter={(label) => `Période : ${label}`}
                  {...chartTooltipStyle}
                />
                <ReferenceLine yAxisId="pos" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                <Bar
                  yAxisId="flow"
                  dataKey="encaissements"
                  name="Encaissements"
                  fill="hsl(142, 71%, 42%)"
                  radius={[3, 3, 0, 0]}
                  barSize={14}
                  opacity={0.85}
                />
                <Bar
                  yAxisId="flow"
                  dataKey="decaissements"
                  name="Décaissements"
                  fill="hsl(0, 72%, 55%)"
                  radius={[3, 3, 0, 0]}
                  barSize={14}
                  opacity={0.75}
                />
                <Bar
                  yAxisId="pos"
                  dataKey="net"
                  name="Net mensuel"
                  shape={<TradingCandleShape />}
                  barSize={10}
                />
                <Area
                  yAxisId="pos"
                  type="monotone"
                  dataKey="close"
                  name="Position cumulative"
                  stroke="hsl(217, 91%, 55%)"
                  strokeWidth={2}
                  fill="url(#financeAreaGreen)"
                  dot={{ r: 3, fill: 'hsl(217, 91%, 55%)', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut charts grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DonutCard
          title="Factures vente par statut"
          description="Répartition du montant TTC par état du workflow"
          data={salesStatusDonut}
          centerLabel="TTC ventes"
          centerValue={
            salesStatusDonut.length > 0
              ? formatMontantDt(salesStatusDonut.reduce((s, d) => s + d.value, 0))
              : undefined
          }
        />

        {showPurchases && (
          <DonutCard
            title="Ventes vs Achats"
            description="Comparaison des montants TTC comptabilisés"
            data={revenueExpenseDonut}
            centerLabel="Volume total"
            centerValue={
              revenueExpenseDonut.length > 0
                ? formatMontantDt(revenueExpenseDonut.reduce((s, d) => s + d.value, 0))
                : undefined
            }
          />
        )}

        <DonutCard
          title="Règlements"
          description="Encaissements clients et décaissements fournisseurs"
          data={paymentsDonut}
          centerLabel="Total flux"
          centerValue={
            paymentsDonut.length > 0
              ? formatMontantDt(paymentsDonut.reduce((s, d) => s + d.value, 0))
              : undefined
          }
        />
      </div>

      {/* Mini activity strip */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Synthèse mensuelle (net)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tradingSeries.map((p) => (
              <div
                key={p.month}
                className="flex flex-col items-center min-w-[52px] gap-1"
                title={`${p.label} : ${formatMontantDt(p.net)}`}
              >
                <div
                  className="w-8 rounded-sm transition-all"
                  style={{
                    height: `${Math.min(64, Math.max(8, Math.abs(p.net) / Math.max(1, ...tradingSeries.map((x) => Math.abs(x.net))) * 64))}px`,
                    marginTop: p.net >= 0 ? 'auto' : undefined,
                    backgroundColor: p.net >= 0 ? 'hsl(142, 71%, 42%)' : 'hsl(0, 72%, 55%)',
                    alignSelf: p.net >= 0 ? 'flex-end' : 'flex-start',
                  }}
                />
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">{p.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

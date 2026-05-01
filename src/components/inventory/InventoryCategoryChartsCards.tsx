import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PIE_COLORS = [
  'hsl(217, 91%, 55%)',
  'hsl(142, 71%, 42%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 55%)',
  'hsl(262, 83%, 58%)',
  'hsl(330, 81%, 55%)',
  'hsl(188, 85%, 42%)',
  'hsl(84, 81%, 44%)',
  'hsl(215, 20%, 50%)',
  'hsl(24, 95%, 53%)',
];

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

export type InventoryBarRow = { name: string; fullName: string; count: number };
export type InventoryPieRow = { name: string; value: number };

type Props = {
  barRows: InventoryBarRow[];
  pieRows: InventoryPieRow[];
  isLoading: boolean;
};

export function InventoryCategoryChartsCards({ barRows, pieRows, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((k) => (
          <Card key={k} className="rounded-2xl border border-border shadow-sm bg-card min-h-[320px] animate-pulse" />
        ))}
      </div>
    );
  }

  const empty = barRows.length === 0 && pieRows.length === 0;

  if (empty) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl border border-border shadow-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Groupes par catégorie
          </CardTitle>
          <p className="text-xs text-muted-foreground">Nombre de groupes produits (top 16)</p>
        </CardHeader>
        <CardContent className="h-[min(360px,50vh)] min-h-[280px]">
          {barRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barRows} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  angle={-32}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  formatter={(v: number) => [v, 'Groupes']}
                  labelFormatter={(_, payload) =>
                    (payload?.[0]?.payload as { fullName?: string })?.fullName || ''
                  }
                  {...chartTooltipStyle}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Groupes" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border shadow-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            Répartition circulaire
          </CardTitle>
          <p className="text-xs text-muted-foreground">Parts par catégorie (donut)</p>
        </CardHeader>
        <CardContent className="h-[min(360px,50vh)] min-h-[280px]">
          {pieRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {pieRows.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v} groupe${v > 1 ? 's' : ''}`, '']}
                  {...chartTooltipStyle}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    color: 'hsl(var(--foreground))',
                  }}
                  layout="horizontal"
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

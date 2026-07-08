import {
  Briefcase,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Car,
  LayoutDashboard,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Tableau de bord', active: true },
  { icon: Briefcase, label: 'Commercial' },
  { icon: ShoppingCart, label: 'Ventes' },
  { icon: Package, label: 'Magasin' },
  { icon: Wallet, label: 'Finance' },
  { icon: Users, label: 'RH' },
  { icon: Car, label: 'Flotte' },
];

const STATS = [
  { label: 'CA mensuel', value: '+24%', delay: 0 },
  { label: 'Stock synchronisé', value: '98%', delay: 100 },
  { label: 'Commandes', value: '1 247', delay: 200 },
];

const BARS = [42, 68, 55, 82, 61, 90, 74];

type Props = {
  className?: string;
  compact?: boolean;
};

/** Animated ERP dashboard mockup — used as hero visual when no marketing video is configured. */
export function ProductShowcase({ className, compact = false }: Props) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm overflow-hidden marketing-video-glow',
        className
      )}
    >
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl marketing-pulse-glow pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2.5 sm:px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="mx-auto flex-1 max-w-[200px] sm:max-w-xs rounded-md bg-background/80 px-3 py-1 text-[10px] sm:text-xs text-muted-foreground text-center truncate">
          app.witnext.tn/dashboard
        </div>
      </div>

      <div className={cn('flex', compact ? 'min-h-[220px]' : 'min-h-[280px] sm:min-h-[340px]')}>
        {/* Sidebar */}
        <aside className="hidden sm:flex w-[52px] lg:w-44 flex-col gap-0.5 border-r border-border/60 bg-muted/20 p-2 shrink-0">
          {SIDEBAR_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] lg:text-xs transition-colors marketing-animate-fade-in',
                item.active
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground'
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <item.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0" />
              <span className="hidden lg:inline truncate">{item.label}</span>
            </div>
          ))}
        </aside>

        {/* Main content */}
        <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Vue d&apos;ensemble</p>
              <p className="text-sm sm:text-base font-bold">Tableau de bord</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="h-3 w-3" />
              En ligne
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-border/60 bg-background/60 p-2 sm:p-2.5 marketing-animate-scale-in"
                style={{ animationDelay: `${stat.delay}ms` }}
              >
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{stat.label}</p>
                <p className="text-xs sm:text-sm font-bold text-primary mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/60 bg-background/50 p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">Activité commerciale</p>
            <div className="flex items-end justify-between gap-1 h-16 sm:h-20">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/80 to-primary/40 marketing-showcase-bar"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${300 + i * 80}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

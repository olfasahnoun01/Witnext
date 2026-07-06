import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatAppDate } from '@/lib/formatAppDate';
import { CalendarDays, ChevronRight, Loader2, LogOut, RefreshCw, Search, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { COMMERCIAL_DOC_KIND_LABELS, totalTrackedActivity } from '@/lib/commercialDocKind';
import {
  BOSS_DOC_TYPE_FILTER_OPTIONS,
  filterBossEmployeeActivities,
  parseBossDocTypeFilter,
  type BossDocTypeFilter,
} from '@/lib/bossActivityFilters';
import {
  loadBossDailyActivity,
  type BossDailyActivity,
} from '@/services/bossCommercialService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function CountPill({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <Badge variant="secondary" className="text-[11px] font-normal">
      {value} {label}
    </Badge>
  );
}

function buildBossQueryParams(date: string, nameQuery: string, typeFilter: BossDocTypeFilter): string {
  const params = new URLSearchParams();
  params.set('date', date);
  if (nameQuery.trim()) params.set('q', nameQuery.trim());
  if (typeFilter !== 'all') params.set('type', typeFilter);
  return params.toString();
}

export function BossCommercialDashboard() {
  const { user, signOut } = useAuth();
  const { currentCompanyId, currentCompany, loading: companyLoading } = useAppCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    () => searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [nameQuery, setNameQuery] = useState(() => searchParams.get('q') ?? '');
  const [typeFilter, setTypeFilter] = useState<BossDocTypeFilter>(() =>
    parseBossDocTypeFilter(searchParams.get('type'))
  );

  useEffect(() => {
    const fromUrl = searchParams.get('date');
    if (fromUrl) setSelectedDate(fromUrl);
    setNameQuery(searchParams.get('q') ?? '');
    setTypeFilter(parseBossDocTypeFilter(searchParams.get('type')));
  }, [searchParams]);

  const syncUrl = useCallback(
    (date: string, q: string, type: BossDocTypeFilter) => {
      const next = buildBossQueryParams(date, q, type);
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  const [activity, setActivity] = useState<BossDailyActivity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentCompanyId) {
      setActivity(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const date = new Date(`${selectedDate}T12:00:00`);
      const data = await loadBossDailyActivity(currentCompanyId, date, {
        excludeUserIds: user?.id ? [user.id] : [],
      });
      setActivity(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Impossible de charger l'activité : ${message}`);
      setActivity(null);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, selectedDate, user?.id]);

  useEffect(() => {
    if (companyLoading) return;
    void load();
  }, [companyLoading, load]);

  const filteredEmployees = useMemo(() => {
    if (!activity) return [];
    return filterBossEmployeeActivities(activity.employees, { nameQuery, typeFilter });
  }, [activity, nameQuery, typeFilter]);

  const filteredDocTotal = useMemo(
    () => filteredEmployees.reduce((sum, e) => sum + e.documents.length, 0),
    [filteredEmployees]
  );

  const dateLabel = formatAppDate(`${selectedDate}T12:00:00`);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              syncUrl(e.target.value, nameQuery, typeFilter);
            }}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/30 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Société</p>
            <p className="font-semibold">{currentCompany?.name ?? '—'}</p>
          </div>
          <CompanySwitcher />
        </div>
        <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
        {activity && (
          <p className="text-sm">
            <span className="font-medium text-foreground">{filteredDocTotal}</span> document
            {filteredDocTotal !== 1 ? 's' : ''}
            {typeFilter !== 'all' || nameQuery.trim() ? ' (filtrés)' : ''}
          </p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filtrer par nom du compte…"
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              syncUrl(selectedDate, e.target.value, typeFilter);
            }}
            className="pl-9"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {BOSS_DOC_TYPE_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={typeFilter === opt.value ? 'default' : 'outline'}
              className={cn('h-8 text-xs', typeFilter === opt.value && 'shadow-sm')}
              onClick={() => {
                setTypeFilter(opt.value);
                syncUrl(selectedDate, nameQuery, opt.value);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {loading || companyLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !currentCompanyId ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Aucune société sélectionnée.</p>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">
            {activity?.employees.length
              ? 'Aucun compte ne correspond aux filtres.'
              : 'Aucun compte commercial trouvé pour cette société.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-8">
          {filteredEmployees.map(({ member, counts, documents }) => {
            const total = totalTrackedActivity(counts);
            const detailQuery = buildBossQueryParams(selectedDate, nameQuery, typeFilter);
            return (
              <Link key={member.userId} to={`/boss/employee/${member.userId}?${detailQuery}`}>
                <Card className="transition-colors hover:bg-muted/40 active:bg-muted/60">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {member.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? '')
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{member.fullName}</p>
                      {member.email && (
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {total === 0 ? (
                          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                            Aucune activité
                          </Badge>
                        ) : typeFilter === 'all' ? (
                          <>
                            <CountPill label="devis cl." value={counts.DEVIS_CLIENT} />
                            <CountPill label="devis fr." value={counts.DEVIS_FOURNISSEUR} />
                            <CountPill label="BC cl." value={counts.BC_CLIENT} />
                            <CountPill label="BC fr." value={counts.BC_FOURNISSEUR} />
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {total} document{total !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      {documents.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Dernier : {documents[0].devisNumber} ·{' '}
                          {COMMERCIAL_DOC_KIND_LABELS[documents[0].kind]}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex justify-center pb-4">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
}

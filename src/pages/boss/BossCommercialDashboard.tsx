import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ChevronRight, Loader2, LogOut, RefreshCw, Users } from 'lucide-react';
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
  loadBossDailyActivity,
  type BossDailyActivity,
} from '@/services/bossCommercialService';
import { toast } from 'sonner';

function CountPill({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <Badge variant="secondary" className="text-[11px] font-normal">
      {value} {label}
    </Badge>
  );
}

export function BossCommercialDashboard() {
  const { signOut } = useAuth();
  const { currentCompanyId, currentCompany, loading: companyLoading } = useAppCompany();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    () => searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  );

  useEffect(() => {
    const fromUrl = searchParams.get('date');
    if (fromUrl && fromUrl !== selectedDate) {
      setSelectedDate(fromUrl);
    }
  }, [searchParams, selectedDate]);
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
      const data = await loadBossDailyActivity(currentCompanyId, date);
      setActivity(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Impossible de charger l'activité : ${message}`);
      setActivity(null);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, selectedDate]);

  useEffect(() => {
    if (companyLoading) return;
    void load();
  }, [companyLoading, load]);

  const dateLabel = format(new Date(`${selectedDate}T12:00:00`), 'EEEE d MMMM yyyy', {
    locale: fr,
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Société</p>
            <p className="font-semibold">{currentCompany?.name ?? '—'}</p>
          </div>
          <CompanySwitcher />
        </div>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{dateLabel}</p>
        {activity && (
          <p className="mt-2 text-sm">
            <span className="font-medium text-foreground">{activity.totalDocuments}</span> document
            {activity.totalDocuments !== 1 ? 's' : ''} aujourd&apos;hui
          </p>
        )}
      </div>

      {loading || companyLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !currentCompanyId ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Aucune société sélectionnée.</p>
      ) : activity?.employees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">Aucun commercial trouvé pour cette société.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-8">
          {activity?.employees.map(({ member, counts, documents }) => {
            const total = totalTrackedActivity(counts);
            return (
              <Link key={member.userId} to={`/boss/employee/${member.userId}?date=${selectedDate}`}>
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
                        ) : (
                          <>
                            <CountPill label="devis cl." value={counts.DEVIS_CLIENT} />
                            <CountPill label="devis fr." value={counts.DEVIS_FOURNISSEUR} />
                            <CountPill label="BC cl." value={counts.BC_CLIENT} />
                            <CountPill label="BC fr." value={counts.BC_FOURNISSEUR} />
                          </>
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

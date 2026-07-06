import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatAppDate } from '@/lib/formatAppDate';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { COMMERCIAL_DOC_KIND_LABELS } from '@/lib/commercialDocKind';
import {
  BOSS_DOC_TYPE_FILTER_OPTIONS,
  filterBossDocuments,
  parseBossDocTypeFilter,
} from '@/lib/bossActivityFilters';
import {
  formatBossDocTime,
  loadBossDailyActivity,
  type BossCommercialDocument,
} from '@/services/bossCommercialService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const KIND_BADGE_CLASS: Record<string, string> = {
  DEVIS_CLIENT: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  DEVIS_FOURNISSEUR: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  BC_CLIENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  BC_FOURNISSEUR: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
};

function DocRow({ doc, userId, searchParams }: { doc: BossCommercialDocument; userId: string; searchParams: URLSearchParams }) {
  const detailQuery = searchParams.toString();
  const href = detailQuery
    ? `/boss/employee/${userId}/doc/${doc.id}?${detailQuery}`
    : `/boss/employee/${userId}/doc/${doc.id}`;

  return (
    <Link to={href} className="block">
      <Card className="transition-colors hover:bg-muted/40 active:bg-muted/60">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{doc.devisNumber}</p>
                <p className="text-xs text-muted-foreground">{formatBossDocTime(doc.createdAt)}</p>
              </div>
              <Badge className={KIND_BADGE_CLASS[doc.kind] ?? ''} variant="outline">
                {COMMERCIAL_DOC_KIND_LABELS[doc.kind]}
              </Badge>
            </div>
            {doc.thirdPartyName && <p className="text-sm text-foreground">{doc.thirdPartyName}</p>}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{doc.status}</span>
              {doc.totalAmount != null && (
                <span className="font-medium text-foreground">
                  {Number(doc.totalAmount).toFixed(3)} TND
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

export function BossEmployeeDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentCompanyId, loading: companyLoading } = useAppCompany();
  const selectedDate = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd');
  const typeFilter = parseBossDocTypeFilter(searchParams.get('type'));
  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('Compte');
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [allDocuments, setAllDocuments] = useState<BossCommercialDocument[]>([]);

  const load = useCallback(async () => {
    if (!currentCompanyId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const date = new Date(`${selectedDate}T12:00:00`);
      const data = await loadBossDailyActivity(currentCompanyId, date);
      const employee = data.employees.find((e) => e.member.userId === userId);
      setMemberName(employee?.member.fullName ?? 'Compte inconnu');
      setMemberEmail(employee?.member.email ?? null);
      setAllDocuments(employee?.documents ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${message}`);
      setAllDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, selectedDate, userId]);

  useEffect(() => {
    if (companyLoading) return;
    void load();
  }, [companyLoading, load]);

  const documents = useMemo(
    () => filterBossDocuments(allDocuments, typeFilter),
    [allDocuments, typeFilter]
  );

  const dateLabel = useMemo(
    () => formatAppDate(`${selectedDate}T12:00:00`),
    [selectedDate]
  );

  const backQuery = searchParams.toString();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-8">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
        <Link to={backQuery ? `/boss?${backQuery}` : '/boss'}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Link>
      </Button>

      <div>
        <h2 className="text-xl font-bold">{memberName}</h2>
        {memberEmail && <p className="text-sm text-muted-foreground">{memberEmail}</p>}
        <p className="mt-1 text-sm capitalize text-muted-foreground">{dateLabel}</p>
        <p className="mt-1 text-sm">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </p>
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
              const next = new URLSearchParams(searchParams);
              if (opt.value === 'all') next.delete('type');
              else next.set('type', opt.value);
              setSearchParams(next, { replace: true });
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {loading || companyLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : documents.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucun document pour ce filtre ce jour.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} userId={userId!} searchParams={searchParams} />
          ))}
        </div>
      )}
    </div>
  );
}

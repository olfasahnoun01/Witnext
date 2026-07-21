import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, Eye, Inbox, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatAppDateTime } from '@/lib/formatAppDate';
import { supabase } from '@/integrations/supabase/client';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import {
  fetchDriverVisitRapports,
  type DriverVisitRapport,
} from '@/services/driverRapportService';

export function DriverVisitRapportsInbox() {
  const { toast } = useToast();
  const [reports, setReports] = useState<DriverVisitRapport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DriverVisitRapport | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchDriverVisitRapports();
      setReports(rows);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Chargement impossible',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useSessionResumeReload(loadReports);
  useCompanyChangeReload(loadReports);

  // Live updates when a chauffeur submits a new visit report.
  useEffect(() => {
    const channel = supabase
      .channel('rh-driver-visit-rapports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rapports' },
        () => {
          void loadReports();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      [r.conducteurNom, r.siteNom, r.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [reports, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (chauffeur, site, description)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des rapports chauffeurs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Inbox className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="font-medium">Aucun rapport de visite</p>
          <p className="text-sm mt-1">
            Les rapports envoyés depuis l&apos;application mobile chauffeur apparaîtront ici en temps réel.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Reçu le</th>
                <th className="px-4 py-3 font-semibold">Chauffeur</th>
                <th className="px-4 py-3 font-semibold">Site</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatAppDateTime(report.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{report.conducteurNom}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {report.siteNom || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-muted-foreground">{report.description || '—'}</p>
                    {report.imageUrls.length > 0 ? (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {report.imageUrls.length} photo
                        {report.imageUrls.length > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(report)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapport de visite</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Reçu le</p>
                <p className="font-medium">{formatAppDateTime(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chauffeur</p>
                <p className="font-medium">{selected.conducteurNom}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Site visité</p>
                <p className="font-medium">{selected.siteNom || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3">
                  {selected.description || '—'}
                </p>
              </div>
              {selected.imageUrls.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Photos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.imageUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border"
                      >
                        <img
                          src={url}
                          alt="Photo du rapport"
                          className="h-32 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

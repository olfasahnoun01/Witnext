import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAppDateTime } from '@/lib/formatAppDate';
import {
  fetchMarketingLeads,
  updateMarketingLead,
  type MarketingLeadRecord,
} from '@/services/marketingLeadService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<MarketingLeadRecord['status'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  converted: 'Converti',
  closed: 'Clôturé',
};

const TYPE_LABELS: Record<MarketingLeadRecord['type'], string> = {
  trial: 'Essai gratuit',
  license: 'Licence',
};

export function MarketingLeadsAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<MarketingLeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | MarketingLeadRecord['status']>('all');
  const [selected, setSelected] = useState<MarketingLeadRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMarketingLeads();
      setLeads(rows);
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
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const openDetail = (lead: MarketingLeadRecord) => {
    setSelected(lead);
    setNotes(lead.internal_notes ?? '');
  };

  const handleStatusChange = async (status: MarketingLeadRecord['status']) => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateMarketingLead(selected.id, {
        status,
        internal_notes: notes || null,
        handled_by: user?.id ?? null,
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selected.id
            ? { ...l, status, internal_notes: notes || null, handled_by: user?.id ?? null }
            : l
        )
      );
      setSelected((s) => (s ? { ...s, status, internal_notes: notes || null } : null));
      toast({ title: 'Demande mise à jour' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Mise à jour impossible',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateMarketingLead(selected.id, {
        internal_notes: notes || null,
        handled_by: user?.id ?? null,
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selected.id ? { ...l, internal_notes: notes || null } : l
        )
      );
      toast({ title: 'Notes enregistrées' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-7 w-7 text-primary" />
            Demandes commerciales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Essais gratuits et demandes de licence depuis le site Witnext.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/users">Gérer les comptes</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'new', 'contacted', 'converted', 'closed'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            {s !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {leads.filter((l) => l.status === s).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Aucune demande pour ce filtre.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Reçu</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Société</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap text-xs">
                    {formatAppDateTime(lead.created_at)}
                  </td>
                  <td className="p-3">{TYPE_LABELS[lead.type]}</td>
                  <td className="p-3 font-medium">{lead.company_name}</td>
                  <td className="p-3">{lead.contact_name}</td>
                  <td className="p-3">{lead.email}</td>
                  <td className="p-3">{lead.plan_code ?? '—'}</td>
                  <td className="p-3">
                    <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                      {STATUS_LABELS[lead.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(lead)}>
                      Détail
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
            <DialogTitle>{selected?.company_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p><span className="text-muted-foreground">Type :</span> {TYPE_LABELS[selected.type]}</p>
                <p><span className="text-muted-foreground">Statut :</span> {STATUS_LABELS[selected.status]}</p>
                <p><span className="text-muted-foreground">Contact :</span> {selected.contact_name}</p>
                <p><span className="text-muted-foreground">Email :</span> {selected.email}</p>
                {selected.phone && <p><span className="text-muted-foreground">Tél :</span> {selected.phone}</p>}
                {selected.plan_code && <p><span className="text-muted-foreground">Plan :</span> {selected.plan_code}</p>}
                {selected.user_count != null && (
                  <p><span className="text-muted-foreground">Utilisateurs :</span> {selected.user_count}</p>
                )}
                {selected.deployment && (
                  <p><span className="text-muted-foreground">Déploiement :</span> {selected.deployment}</p>
                )}
              </div>
              {selected.modules.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Modules :</span>{' '}
                  {selected.modules.join(', ')}
                </p>
              )}
              {selected.message && (
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{selected.message}</p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes internes</label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Suivi commercial..."
                />
                <Button size="sm" variant="outline" onClick={saveNotes} disabled={saving}>
                  Enregistrer les notes
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Changer le statut</label>
                <Select
                  value={selected.status}
                  onValueChange={(v) => handleStatusChange(v as MarketingLeadRecord['status'])}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

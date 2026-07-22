import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Plus, Receipt, RefreshCw, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createTenantWithOwner,
  grantTenantLicense,
  listPlatformTenants,
  setPlatformTenantStatus,
  type PlatformTenantRow,
} from '@/lib/platformService';
import { formatAppDate, formatAppDateTime } from '@/lib/formatAppDate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccessDenied } from '@/router/RouteGuards';

const PLAN_LABELS: Record<PlatformTenantRow['plan'], string> = {
  trial: 'Essai',
  starter: 'Essentiel',
  pro: 'Pro',
  enterprise: 'Entreprise',
};

const STATUS_LABELS: Record<PlatformTenantRow['status'], string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  cancelled: 'Annulé',
};

function addMonthsIso(isoDate: string, months: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PlatformConsole() {
  const { isPlatformAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<PlatformTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseTenant, setLicenseTenant] = useState<PlatformTenantRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [plan, setPlan] = useState<PlatformTenantRow['plan']>('trial');
  const [maxUsers, setMaxUsers] = useState('5');

  const [licPlan, setLicPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [licCycle, setLicCycle] = useState<'monthly' | 'annual'>('annual');
  const [licStart, setLicStart] = useState(new Date().toISOString().slice(0, 10));
  const [licEnd, setLicEnd] = useState(addMonthsIso(new Date().toISOString().slice(0, 10), 12));
  const [licAmount, setLicAmount] = useState('3990');
  const [licMaxUsers, setLicMaxUsers] = useState('25');
  const [licNotes, setLicNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPlatformTenants();
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error ?? 'Chargement impossible',
        });
        setTenants([]);
        return;
      }
      setTenants(result.tenants);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && isPlatformAdmin) void load();
  }, [authLoading, isPlatformAdmin, load]);

  const resetForm = () => {
    setCompanyName('');
    setOwnerEmail('');
    setOwnerPassword('');
    setOwnerFullName('');
    setPlan('trial');
    setMaxUsers('5');
  };

  const openLicenseDialog = (tenant: PlatformTenantRow) => {
    setLicenseTenant(tenant);
    const start = new Date().toISOString().slice(0, 10);
    setLicStart(start);
    setLicCycle('annual');
    setLicEnd(addMonthsIso(start, 12));
    const nextPlan =
      tenant.plan === 'trial' || tenant.plan === 'starter'
        ? 'pro'
        : (tenant.plan as 'starter' | 'pro' | 'enterprise');
    setLicPlan(nextPlan);
    setLicAmount(nextPlan === 'starter' ? '1490' : nextPlan === 'pro' ? '3990' : '0');
    setLicMaxUsers(String(tenant.maxUsers || 25));
    setLicNotes('');
    setLicenseOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createTenantWithOwner({
        companyName,
        ownerEmail,
        ownerPassword,
        ownerFullName,
        plan,
        maxUsers: Math.max(1, Number.parseInt(maxUsers, 10) || 5),
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Création impossible',
          description: result.error,
        });
        return;
      }
      toast({
        title: 'Client créé',
        description: `${companyName.trim()} — admin : ${ownerEmail.trim().toLowerCase()}`,
      });
      setCreateOpen(false);
      resetForm();
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrantLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseTenant) return;
    setSubmitting(true);
    try {
      const periodStart = new Date(licStart + 'T00:00:00').toISOString();
      const periodEnd = new Date(licEnd + 'T23:59:59').toISOString();
      const result = await grantTenantLicense({
        tenantId: licenseTenant.tenantId,
        plan: licPlan,
        billingCycle: licCycle,
        periodStart,
        periodEnd,
        amountHt: Number.parseFloat(licAmount) || 0,
        maxUsers: Math.max(1, Number.parseInt(licMaxUsers, 10) || 1),
        notes: licNotes,
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Licence impossible',
          description: result.error,
        });
        return;
      }
      toast({
        title: 'Licence activée',
        description: `Reçu ${result.numero} — ${licenseTenant.tenantName}`,
      });
      setLicenseOpen(false);
      setLicenseTenant(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (tenant: PlatformTenantRow, status: PlatformTenantRow['status']) => {
    const result = await setPlatformTenantStatus(tenant.tenantId, status);
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error,
      });
      return;
    }
    toast({
      title: 'Statut mis à jour',
      description: `${tenant.tenantName} → ${STATUS_LABELS[status]}`,
    });
    await load();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Console plateforme</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez des organisations, activez les licences et émettez les reçus visibles dans
                Facturation côté client.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau client
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-40" />
            <p className="text-sm">Aucun client pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Organisation</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Fin licence</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Sociétés</th>
                  <th className="px-4 py-3 font-medium">Utilisateurs</th>
                  <th className="px-4 py-3 font-medium">Créé</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.tenantId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{t.tenantName}</div>
                      <div className="text-xs text-muted-foreground">{t.slug}</div>
                    </td>
                    <td className="px-4 py-3">{PLAN_LABELS[t.plan]}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.licenseEndsAt
                        ? formatAppDate(t.licenseEndsAt)
                        : t.trialEndsAt
                          ? `Essai → ${formatAppDate(t.trialEndsAt)}`
                          : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          t.status === 'active'
                            ? 'default'
                            : t.status === 'suspended'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {t.companyCount}/{t.maxCompanies}
                    </td>
                    <td className="px-4 py-3">
                      {t.memberCount}/{t.maxUsers}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatAppDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="gap-1"
                          onClick={() => openLicenseDialog(t)}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Licence
                        </Button>
                        {t.status !== 'active' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStatus(t, 'active')}
                          >
                            Activer
                          </Button>
                        ) : null}
                        {t.status === 'active' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStatus(t, 'suspended')}
                          >
                            Suspendre
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-company">Nom de l&apos;organisation</Label>
              <Input
                id="platform-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex. Acme SARL"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-owner-name">Nom de l&apos;administrateur</Label>
              <Input
                id="platform-owner-name"
                value={ownerFullName}
                onChange={(e) => setOwnerFullName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-owner-email">Email administrateur</Label>
              <Input
                id="platform-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-owner-password">Mot de passe initial</Label>
              <PasswordInput
                id="platform-owner-password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={12}
              />
              <p className="text-xs text-muted-foreground">Minimum 12 caractères.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as PlatformTenantRow['plan'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Essai</SelectItem>
                    <SelectItem value="starter">Essentiel</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Entreprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform-max-users">Max utilisateurs</Label>
                <Input
                  id="platform-max-users"
                  type="number"
                  min={1}
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={licenseOpen} onOpenChange={setLicenseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activer licence — {licenseTenant?.tenantName ?? ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleGrantLicense(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Offre</Label>
                <Select
                  value={licPlan}
                  onValueChange={(v) => setLicPlan(v as 'starter' | 'pro' | 'enterprise')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Essentiel</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Entreprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cycle</Label>
                <Select
                  value={licCycle}
                  onValueChange={(v) => {
                    const cycle = v as 'monthly' | 'annual';
                    setLicCycle(cycle);
                    setLicEnd(addMonthsIso(licStart, cycle === 'monthly' ? 1 : 12));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                    <SelectItem value="annual">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Début</Label>
                <Input
                  type="date"
                  value={licStart}
                  onChange={(e) => {
                    setLicStart(e.target.value);
                    setLicEnd(addMonthsIso(e.target.value, licCycle === 'monthly' ? 1 : 12));
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fin de licence</Label>
                <Input
                  type="date"
                  value={licEnd}
                  onChange={(e) => setLicEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT (TND)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={licAmount}
                  onChange={(e) => setLicAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max utilisateurs</Label>
                <Input
                  type="number"
                  min={1}
                  value={licMaxUsers}
                  onChange={(e) => setLicMaxUsers(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Input
                value={licNotes}
                onChange={(e) => setLicNotes(e.target.value)}
                placeholder="Réf. devis, paiement…"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Un reçu PDF sera disponible pour le client dans Facturation &amp; licence.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLicenseOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Activer &amp; émettre reçu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

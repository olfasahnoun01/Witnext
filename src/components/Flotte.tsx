import { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Loader2, Bell, CheckCircle2, Pencil, UserCheck, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  buildVehicleReminderRows,
  isReminderDue,
  localDateIso,
  upsertVehicleRemindersForVehicle,
} from '@/lib/vehicleReminders';
import { syncVehicleReminderNotifications } from '@/services/notificationService';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { cn } from '@/lib/utils';
import { FLOTTE_EXCEL_TABLE_CLASS } from '@/lib/tableStyles';

interface Vehicle {
  id: string;
  modele: string; // Type commercial / nom voiture
  matricule: string;
  constructeur?: string | null;
  type_carburant?: string | null;
  kilometrage_actuel?: number | null;
  leasing_company?: string | null;
  leasing_contract_number?: string | null;
  company_owner?: string | null;
  mise_en_circulation?: string | null;
  loyer_amount?: number | null;
  leasing_due_date?: string | null;
  leasing_remind_at?: string | null;
  assureur?: string | null;
  assurance_due_date?: string | null;
  assurance_remind_at?: string | null;
  vignette_due_date?: string | null;
  vignette_remind_at?: string | null;
  visite_technique_end_date?: string | null;
  visite_technique_remind_at?: string | null;
  contract_holder_name?: string | null;
  contract_document_url?: string | null;
  statut?: 'disponible' | 'en_fonction' | 'en_panne';
  conducteur_id?: string | null;
}

interface Driver {
  id: string;
  nom: string;
  prenom: string;
  role?: string | null;
}

const normalizeRole = (value?: string | null) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

interface VehicleReminder {
  id: string;
  vehicle_id: string;
  reminder_type: 'vignette' | 'assurance' | 'leasing' | 'visite_technique';
  due_date: string;
  remind_at: string;
  is_done: boolean;
  note: string | null;
  vehicle?: Pick<Vehicle, 'modele' | 'matricule'> | null;
}

const reminderLabel: Record<VehicleReminder['reminder_type'], string> = {
  vignette: 'Vignette',
  assurance: 'Assurance',
  leasing: 'Leasing',
  visite_technique: 'Visite technique',
};

const CONSTRUCTEURS = [
  'Volkswagen',
  'Toyota',
  'Fiat',
  'Renault',
  'Dacia',
  'Peugeot',
  'Citroën',
  'Ford',
  'Audi',
  'BMW',
  'Mercedes',
  'Nissan',
  'Hyundai',
  'Kia',
  'Iveco',
  'MAN',
  'Volvo',
  'Suzuki',
  'Mazda',
  'Opel',
  'Skoda',
  'Autre',
] as const;

export const Flotte = ({ initialSection = 'flotte' }: { initialSection?: 'flotte' | 'status' }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reminders, setReminders] = useState<VehicleReminder[]>([]);
  const [section, setSection] = useState<'flotte' | 'status'>(initialSection);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    constructeur: '',
    modele: '',
    matricule: '',
    type_carburant: 'gasoil',
    kilometrage_actuel: '',
    leasing_company: '',
    leasing_contract_number: '',
    company_owner: '',
    mise_en_circulation: '',
    loyer_amount: '',
    leasing_due_date: '',
    leasing_remind_at: '',
    assureur: '',
    assurance_due_date: '',
    assurance_remind_at: '',
    vignette_due_date: '',
    vignette_remind_at: '',
    visite_technique_end_date: '',
    visite_technique_remind_at: '',
    contract_holder_name: '',
    contract_document_url: '',
  });

  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null);
  const [selectedDriverByVehicle, setSelectedDriverByVehicle] = useState<Record<string, string>>({});

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const today = localDateIso();
      const cid = getActiveCompanyId();
      const vehiclesQuery = supabase.from('vehicles').select('*');
      const employeesQuery = supabase.from('employees').select('id, nom, prenom, role');
      const [vehiclesRes, remindersRes, driversRes] = await Promise.all([
        (cid ? vehiclesQuery.eq('company_id' as any, cid) : vehiclesQuery).order('created_at', { ascending: false }),
        supabase
          .from('vehicle_reminders')
          .select('*, vehicle:vehicles(modele, matricule)')
          .eq('is_done', false)
          .lte('remind_at', today)
          .order('remind_at', { ascending: true }),
        (cid ? employeesQuery.eq('company_id' as any, cid) : employeesQuery).order('nom'),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (remindersRes.error) throw remindersRes.error;
      if (driversRes.error) throw driversRes.error;
      setVehicles((vehiclesRes.data || []) as Vehicle[]);
      setReminders((remindersRes.data || []) as unknown as VehicleReminder[]);
      const allEmployees = (driversRes.data || []) as Driver[];
      const chauffeurs = allEmployees.filter((emp) => {
        const role = normalizeRole(emp.role);
        return (
          role.includes('chauffeur') ||
          role.includes('conducteur') ||
          role.includes('driver') ||
          role.includes('operateur')
        );
      });
      setDrivers(chauffeurs);
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      toast.error('Erreur lors du chargement de la flotte');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  useCompanyChangeReload(fetchVehicles);

  const openAddDialog = () => {
    setForm({
      constructeur: '',
      modele: '',
      matricule: '',
      type_carburant: 'gasoil',
      kilometrage_actuel: '',
      leasing_company: '',
      leasing_contract_number: '',
      company_owner: '',
      mise_en_circulation: '',
      loyer_amount: '',
      leasing_due_date: '',
      leasing_remind_at: '',
      assureur: '',
      assurance_due_date: '',
      assurance_remind_at: '',
      vignette_due_date: '',
      vignette_remind_at: '',
      visite_technique_end_date: '',
      visite_technique_remind_at: '',
      contract_holder_name: '',
      contract_document_url: '',
    });
    setEditingVehicle(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      constructeur: vehicle.constructeur || '',
      modele: vehicle.modele || '',
      matricule: vehicle.matricule || '',
      type_carburant: vehicle.type_carburant || 'gasoil',
      kilometrage_actuel: vehicle.kilometrage_actuel != null ? String(vehicle.kilometrage_actuel) : '',
      leasing_company: vehicle.leasing_company || '',
      leasing_contract_number: vehicle.leasing_contract_number || '',
      company_owner: vehicle.company_owner || '',
      mise_en_circulation: vehicle.mise_en_circulation || '',
      loyer_amount: vehicle.loyer_amount != null ? String(vehicle.loyer_amount) : '',
      leasing_due_date: vehicle.leasing_due_date || '',
      leasing_remind_at: vehicle.leasing_remind_at || '',
      assureur: vehicle.assureur || '',
      assurance_due_date: vehicle.assurance_due_date || '',
      assurance_remind_at: vehicle.assurance_remind_at || '',
      vignette_due_date: vehicle.vignette_due_date || '',
      vignette_remind_at: vehicle.vignette_remind_at || '',
      visite_technique_end_date: vehicle.visite_technique_end_date || '',
      visite_technique_remind_at: vehicle.visite_technique_remind_at || '',
      contract_holder_name: vehicle.contract_holder_name || '',
      contract_document_url: vehicle.contract_document_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.modele.trim()) {
      toast.error('Type commercial requis');
      return;
    }
    if (!form.matricule.trim()) {
      toast.error('Matricule requis');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        constructeur: form.constructeur || null,
        modele: form.modele.trim(),
        matricule: form.matricule.trim(),
        type_carburant: form.type_carburant || 'gasoil',
        kilometrage_actuel: form.kilometrage_actuel ? Number(form.kilometrage_actuel) : 0,
        leasing_company: form.leasing_company.trim() || null,
        leasing_contract_number: form.leasing_contract_number.trim() || null,
        company_owner: form.company_owner.trim() || null,
        mise_en_circulation: form.mise_en_circulation || null,
        loyer_amount: form.loyer_amount ? Number(form.loyer_amount) : null,
        leasing_due_date: form.leasing_due_date || null,
        leasing_remind_at: form.leasing_remind_at || null,
        assureur: form.assureur.trim() || null,
        assurance_due_date: form.assurance_due_date || null,
        assurance_remind_at: form.assurance_remind_at || null,
        vignette_due_date: form.vignette_due_date || null,
        vignette_remind_at: form.vignette_remind_at || null,
        visite_technique_end_date: form.visite_technique_end_date || null,
        visite_technique_remind_at: form.visite_technique_remind_at || null,
        contract_holder_name: form.contract_holder_name.trim() || null,
        contract_document_url: form.contract_document_url.trim() || null,
      };
      let vehicleId = editingVehicle?.id;
      if (editingVehicle) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([{ ...payload, company_id: getActiveCompanyId() || undefined } as never])
          .select('id')
          .single();
        if (error) throw error;
        vehicleId = data?.id;
      }

      if (vehicleId) {
        const reminderResult = await upsertVehicleRemindersForVehicle({
          id: vehicleId,
          vignette_due_date: form.vignette_due_date || null,
          vignette_remind_at: form.vignette_remind_at || null,
          assurance_due_date: form.assurance_due_date || null,
          assurance_remind_at: form.assurance_remind_at || null,
          leasing_due_date: form.leasing_due_date || null,
          leasing_remind_at: form.leasing_remind_at || null,
          visite_technique_end_date: form.visite_technique_end_date || null,
          visite_technique_remind_at: form.visite_technique_remind_at || null,
        });
        if (!reminderResult.ok) {
          console.warn('[Flotte] vehicle reminders:', reminderResult.error);
        }
        void syncVehicleReminderNotifications();
      }

      toast.success(editingVehicle ? 'Véhicule mis à jour' : 'Véhicule ajouté');
      setIsDialogOpen(false);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde du véhicule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      toast.success('Véhicule supprimé');
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getDriverName = (driverId?: string | null) => {
    if (!driverId) return null;
    const driver = drivers.find((d) => d.id === driverId);
    return driver ? `${driver.prenom} ${driver.nom}`.trim() : null;
  };

  const assignVehicleToDriver = async (vehicleId: string) => {
    const driverId = selectedDriverByVehicle[vehicleId];
    if (!driverId) {
      toast.error('Sélectionnez un chauffeur');
      return;
    }
    const targetDriverName = getDriverName(driverId) || 'ce chauffeur';
    const otherAssignedVehicle = vehicles.find(
      (v) => v.id !== vehicleId && v.conducteur_id === driverId && v.statut === 'en_fonction'
    );
    if (otherAssignedVehicle) {
      toast.info(
        `${targetDriverName} est déjà affecté à ${otherAssignedVehicle.modele} (${otherAssignedVehicle.matricule}).`
      );
      const proceed = window.confirm(
        `${targetDriverName} a déjà un véhicule assigné (${otherAssignedVehicle.modele} - ${otherAssignedVehicle.matricule}). Voulez-vous vraiment lui assigner un 2ème véhicule ?`
      );
      if (!proceed) return;
    }
    setAssigningVehicleId(vehicleId);
    const { error } = await supabase
      .from('vehicles')
      .update({
        conducteur_id: driverId,
        statut: 'en_fonction',
      })
      .eq('id', vehicleId);
    setAssigningVehicleId(null);
    if (error) {
      toast.error('Erreur lors de l’affectation du véhicule');
      return;
    }
    toast.success('Véhicule affecté');
    await fetchVehicles();
  };

  const setVehicleAvailable = async (vehicleId: string) => {
    const { error } = await supabase
      .from('vehicles')
      .update({
        conducteur_id: null,
        statut: 'disponible',
      })
      .eq('id', vehicleId);
    if (error) {
      toast.error('Erreur lors de la libération du véhicule');
      return;
    }
    toast.success('Véhicule marqué disponible');
    await fetchVehicles();
  };

  const statusBadgeClass = (status?: Vehicle['statut']) => {
    switch (status) {
      case 'en_fonction':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'en_panne':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const statusLabel = (status?: Vehicle['statut']) => {
    switch (status) {
      case 'en_fonction':
        return 'En fonction';
      case 'en_panne':
        return 'En panne';
      default:
        return 'Disponible';
    }
  };

  const handleCreateReminders = async (vehicle: Vehicle) => {
    const rows = buildVehicleReminderRows(vehicle);
    if (rows.length === 0) {
      toast.error('Renseignez au moins une date d\'échéance ou une date de rappel');
      return;
    }
    const result = await upsertVehicleRemindersForVehicle(vehicle);
    if (!result.ok) {
      toast.error('Erreur création rappels');
      return;
    }
    void syncVehicleReminderNotifications();
    toast.success('Rappels créés');
    fetchVehicles();
  };

  const markReminderDone = async (id: string) => {
    const { error } = await supabase.from('vehicle_reminders').update({ is_done: true }).eq('id', id);
    if (error) {
      toast.error('Erreur mise à jour rappel');
      return;
    }
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const renderVehicleActionsMenu = (v: Vehicle) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Actions sur le véhicule"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem onClick={() => openEditDialog(v)} className="gap-2 cursor-pointer">
          <Pencil className="h-4 w-4" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleCreateReminders(v)} className="gap-2 cursor-pointer">
          <Bell className="h-4 w-4" />
          Créer rappels
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          onClick={() => void handleDelete(v.id)}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Flotte de Véhicules</h2>
            <p className="text-sm text-muted-foreground">
              {vehicles.length} véhicule{vehicles.length !== 1 ? 's' : ''} enregistré{vehicles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="w-4 h-4" />
          Ajouter Véhicule
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 w-fit">
        <Button
          variant={section === 'flotte' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('flotte')}
        >
          Flotte
        </Button>
        <Button
          variant={section === 'status' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSection('status')}
        >
          Status
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold">Centre de notifications (Rappels véhicules)</h3>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun rappel en attente.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {reminders.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between rounded-lg border p-2 ${
                  isReminderDue(r.remind_at)
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-border'
                }`}
              >
                <div className="text-sm">
                  <span className="font-medium">{reminderLabel[r.reminder_type]}</span>
                  {' · '}
                  {(r.vehicle?.modele || 'Véhicule')} ({r.vehicle?.matricule || '-'})
                  {' · Rappel: '}
                  {new Date(`${r.remind_at}T12:00:00`).toLocaleDateString('fr-FR')}
                  {' · Échéance: '}
                  {new Date(`${r.due_date}T12:00:00`).toLocaleDateString('fr-FR')}
                </div>
                <Button size="sm" variant="outline" onClick={() => markReminderDone(r.id)} className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Traité
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
          <div className="p-5 rounded-2xl bg-primary/10 mb-4">
            <Truck className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucun véhicule</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            Cliquez sur « Ajouter Véhicule » pour enregistrer les véhicules de la société.
          </p>
          <Button variant="outline" onClick={openAddDialog} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            Ajouter un véhicule
          </Button>
        </div>
      ) : section === 'status' ? (
        <div className="grid gap-4">
          {vehicles.map((v) => {
            const driverName = getDriverName(v.conducteur_id);
            return (
              <div key={v.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{v.modele} ({v.matricule})</p>
                    <p className="text-xs text-muted-foreground">
                      {driverName ? `Affecté à ${driverName}` : 'Aucun chauffeur affecté'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(v.statut)}`}>
                    {statusLabel(v.statut)}
                  </span>
                </div>

                {v.statut === 'en_panne' ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Ce véhicule est en panne (mis à jour automatiquement depuis Maintenance).
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-center">
                    <Select
                      value={selectedDriverByVehicle[v.id] || ''}
                      onValueChange={(value) =>
                        setSelectedDriverByVehicle((prev) => ({ ...prev, [v.id]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Affecter à un chauffeur" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Aucun chauffeur trouvé dans la liste employés
                          </div>
                        ) : (
                          drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {`${d.prenom} ${d.nom}`.trim()}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => assignVehicleToDriver(v.id)}
                      disabled={assigningVehicleId === v.id || drivers.length === 0}
                      className="gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      Assigner
                    </Button>
                    <Button variant="outline" onClick={() => setVehicleAvailable(v.id)}>
                      Marquer disponible
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(
            'overflow-x-auto rounded-xl border border-sky-500/30 bg-card shadow-sm',
            FLOTTE_EXCEL_TABLE_CLASS
          )}
        >
          <table>
            <thead>
              <tr>
                <th className="w-12">Actions</th>
                <th>Type commercial</th>
                <th>Matricule</th>
                <th>Contrat leasing</th>
                <th>N° contract</th>
                <th>Société</th>
                <th>Mise en circulation</th>
                <th>Loyer</th>
                <th>Échéance leasing</th>
                <th>Assureur</th>
                <th>Échéance assurance</th>
                <th>Vignettes</th>
                <th>Fin visite technique</th>
                <th>Contrat au nom du</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="flex justify-center">{renderVehicleActionsMenu(v)}</div>
                  </td>
                  <td className="font-medium text-foreground">{v.modele || '-'}</td>
                  <td>
                    <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                      {v.matricule || '-'}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{v.leasing_company || '-'}</td>
                  <td className="text-muted-foreground">{v.leasing_contract_number || '-'}</td>
                  <td>{v.company_owner || '-'}</td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {v.mise_en_circulation ? new Date(v.mise_en_circulation).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="whitespace-nowrap font-medium tabular-nums text-foreground">
                    {v.loyer_amount != null ? `${v.loyer_amount.toLocaleString()} TND` : '-'}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {v.leasing_due_date ? new Date(v.leasing_due_date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td>{v.assureur || '-'}</td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {v.assurance_due_date ? new Date(v.assurance_due_date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {v.vignette_due_date ? new Date(v.vignette_due_date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {v.visite_technique_end_date ? new Date(v.visite_technique_end_date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td>{v.contract_holder_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[98vw] max-w-5xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {editingVehicle ? 'Modifier véhicule' : 'Ajouter véhicule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-3 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Informations voiture</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Constructeur *</Label>
                  <Select value={form.constructeur} onValueChange={(v) => setForm((f) => ({ ...f, constructeur: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une marque" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {CONSTRUCTEURS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Type commercial *</Label>
                  <Input value={form.modele} onChange={(e) => setForm((f) => ({ ...f, modele: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Matricule *</Label>
                  <Input value={form.matricule} onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Type carburant *</Label>
                  <Select value={form.type_carburant} onValueChange={(v) => setForm((f) => ({ ...f, type_carburant: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasoil">Gasoil</SelectItem>
                      <SelectItem value="essence">Essence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>KM actuelle</Label>
                  <Input type="number" value={form.kilometrage_actuel} onChange={(e) => setForm((f) => ({ ...f, kilometrage_actuel: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Informations leasing</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Contrat leasing</Label><Input value={form.leasing_company} onChange={(e) => setForm((f) => ({ ...f, leasing_company: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>N° contract</Label><Input value={form.leasing_contract_number} onChange={(e) => setForm((f) => ({ ...f, leasing_contract_number: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Société</Label><Input value={form.company_owner} onChange={(e) => setForm((f) => ({ ...f, company_owner: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Mise en circulation</Label><Input type="date" value={form.mise_en_circulation} onChange={(e) => setForm((f) => ({ ...f, mise_en_circulation: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Loyer (montant)</Label><Input type="number" value={form.loyer_amount} onChange={(e) => setForm((f) => ({ ...f, loyer_amount: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Échéance leasing</Label><Input type="date" value={form.leasing_due_date} onChange={(e) => setForm((f) => ({ ...f, leasing_due_date: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Date rappel leasing</Label><Input type="date" value={form.leasing_remind_at} onChange={(e) => setForm((f) => ({ ...f, leasing_remind_at: e.target.value }))} /></div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Vignettes / Assurance</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Assureur</Label><Input value={form.assureur} onChange={(e) => setForm((f) => ({ ...f, assureur: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Échéance assurance</Label><Input type="date" value={form.assurance_due_date} onChange={(e) => setForm((f) => ({ ...f, assurance_due_date: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Date rappel assurance</Label><Input type="date" value={form.assurance_remind_at} onChange={(e) => setForm((f) => ({ ...f, assurance_remind_at: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Vignettes</Label><Input type="date" value={form.vignette_due_date} onChange={(e) => setForm((f) => ({ ...f, vignette_due_date: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Date rappel vignette</Label><Input type="date" value={form.vignette_remind_at} onChange={(e) => setForm((f) => ({ ...f, vignette_remind_at: e.target.value }))} /></div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Visite technique</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Fin visite technique</Label><Input type="date" value={form.visite_technique_end_date} onChange={(e) => setForm((f) => ({ ...f, visite_technique_end_date: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>Date rappel visite technique</Label><Input type="date" value={form.visite_technique_remind_at} onChange={(e) => setForm((f) => ({ ...f, visite_technique_remind_at: e.target.value }))} /></div>
                <div className="grid gap-2"><Label>À charger les contrat au nom du</Label><Input value={form.contract_holder_name} onChange={(e) => setForm((f) => ({ ...f, contract_holder_name: e.target.value }))} /></div>
                <div className="grid gap-2 col-span-2"><Label>URL contrat (optionnel)</Label><Input value={form.contract_document_url} onChange={(e) => setForm((f) => ({ ...f, contract_document_url: e.target.value }))} /></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl" disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="gap-2 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                editingVehicle ? 'Mettre à jour' : 'Ajouter'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

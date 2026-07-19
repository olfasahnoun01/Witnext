import { useState, useEffect, useMemo } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { Fuel, Plus, Search, Calendar, User, Car, Banknote, ClipboardList, Loader2, Image as ImageIcon, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimalInput } from '@/lib/numberInput';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getActiveCompanyId, requireActiveCompanyId } from '@/lib/activeCompany';
import { getFuelVoucherStatusDisplay, fuelVoucherStatusBadgeClass } from '@/lib/fuelVoucherStatus';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';
import {
  computeFuelVoucherDistance,
  fetchLastApprovedKmFinal,
  resolveVoucherKmFinal,
} from '@/lib/fuelVoucherKm';

interface FuelVoucher {
  id: string;
  num_bon: string;
  date: string;
  montant: number;
  conducteur_id: string | null;
  vehicule_id: string | null;
  type_carburant: string | null;
  notes: string | null;
  status: string | null;
  km: number | null;
  km_initial: number | null;
  distance: number | null;
  proof_image_url: string | null;
  created_at?: string;
  // Joined data
  employee?: { prenom: string; nom: string } | null;
  vehicle?: { modele: string; matricule: string } | null;
}

interface Employee {
  id: string;
  prenom: string;
  nom: string;
}

interface Vehicle {
  id: string;
  modele: string;
  matricule: string;
  constructeur?: string | null;
  kilometrage_actuel?: number | null;
  type_carburant?: string | null;
}

export const BonCarburant = () => {
  const { isAdmin } = useAuth();
  const [bons, setBons] = useState<FuelVoucher[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FuelVoucher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [kmInitialAutoFilled, setKmInitialAutoFilled] = useState(false);
  const [filterVehicleId, setFilterVehicleId] = useState<string>('all');
  const [filterDriverId, setFilterDriverId] = useState<string>('all');

  const [form, setForm] = useState({
    numBon: '',
    date: new Date().toISOString().split('T')[0],
    montant: '',
    conducteurId: '',
    typeCarburant: 'gasoil' as string,
    vehiculeId: '',
    kmInitial: '',
    kmFinal: '',
    notes: '',
  });

  const emptyForm = () => ({
    numBon: '',
    date: new Date().toISOString().split('T')[0],
    montant: '',
    conducteurId: '',
    typeCarburant: 'gasoil' as string,
    vehiculeId: '',
    kmInitial: '',
    kmFinal: '',
    notes: '',
  });

  const openNewDialog = () => {
    setEditingVoucherId(null);
    setKmInitialAutoFilled(false);
    setForm(emptyForm());
    setIsDialogOpen(true);
  };

  const getVoucherDistance = (bon: FuelVoucher): number | null => {
    const kmFinal = resolveVoucherKmFinal(bon);
    const fromCalc = computeFuelVoucherDistance(kmFinal, bon.km_initial);
    if (fromCalc != null) return fromCalc;
    if (bon.distance != null && !Number.isNaN(Number(bon.distance))) {
      return Number(bon.distance);
    }
    return null;
  };

  const handleVehicleChange = async (vehicleId: string) => {
    const veh = vehicles.find((x) => x.id === vehicleId);
    const fuel =
      veh?.type_carburant === 'essence' || veh?.type_carburant === 'gasoil'
        ? veh.type_carburant
        : 'gasoil';

    if (editingVoucherId) {
      setForm((prev) => ({ ...prev, vehiculeId: vehicleId, typeCarburant: fuel }));
      return;
    }

    const lastKmFinal = await fetchLastApprovedKmFinal(vehicleId);
    setKmInitialAutoFilled(lastKmFinal != null);
    setForm((prev) => ({
      ...prev,
      vehiculeId: vehicleId,
      typeCarburant: fuel,
      kmInitial: lastKmFinal != null ? String(lastKmFinal) : '',
      kmFinal: '',
    }));
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bonsRes, empRes, vehRes] = await Promise.all([
        supabase
          .from('fuel_vouchers')
          .select('*, employee:employees(prenom, nom), vehicle:vehicles(modele, matricule)')
          .order('created_at', { ascending: false }),
        supabase.from('employees').select('id, prenom, nom').order('prenom'),
        supabase.from('vehicles').select('id, modele, matricule, constructeur, kilometrage_actuel, type_carburant').order('modele'),
      ]);

      if (bonsRes.error) throw bonsRes.error;
      if (empRes.error) throw empRes.error;
      if (vehRes.error) throw vehRes.error;

      setBons((bonsRes.data as any) || []);
      setEmployees(empRes.data || []);
      setVehicles(vehRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('fuel_vouchers_desktop')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuel_vouchers' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async () => {
    if (!form.numBon || !form.montant || !form.conducteurId || !form.vehiculeId) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      const kmFinal = form.kmFinal.trim() ? Number(form.kmFinal) : null;
      const kmInitial = form.kmInitial.trim() ? Number(form.kmInitial) : null;

      if (!editingVoucherId && kmInitial == null) {
        toast.error(
          'Indiquez le kilométrage initial. Pour un premier bon, saisissez-le manuellement ; pour les suivants, il est repris du dernier km final approuvé.'
        );
        return;
      }

      if (kmFinal != null && kmInitial != null && kmFinal < kmInitial) {
        toast.error('Le kilométrage final doit être supérieur ou égal au kilométrage initial');
        return;
      }

      const distance = computeFuelVoucherDistance(kmFinal, kmInitial);

      const payload = {
        num_bon: form.numBon.trim(),
        date: form.date,
        montant: parseDecimalInput(form.montant),
        conducteur_id: form.conducteurId,
        vehicule_id: form.vehiculeId,
        type_carburant: form.typeCarburant,
        notes: form.notes.trim() || null,
        company_id: requireActiveCompanyId(),
        ...(editingVoucherId
          ? {
              km: kmFinal,
              km_initial: kmInitial,
              distance,
            }
          : {
              km: null,
              km_initial: kmInitial,
              distance: null,
              status: 'pending',
              voucher_type: 'bon_carburant',
            }),
      };
      const query = editingVoucherId
        ? supabase.from('fuel_vouchers').update(payload).eq('id', editingVoucherId)
        : supabase.from('fuel_vouchers').insert([payload]);
      const { error } = await query;

      if (error) throw error;

      toast.success(editingVoucherId ? 'Bon de carburant modifié' : 'Bon de carburant ajouté');
      setForm(emptyForm());
      setEditingVoucherId(null);
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding voucher:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du bon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('fuel_vouchers').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success(`Bon ${deleteConfirm.num_bon} supprimé`);
      setDeleteConfirm(null);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      console.error('Error deleting fuel voucher:', error);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (bon: FuelVoucher) => {
    setEditingVoucherId(bon.id);
    setForm({
      numBon: bon.num_bon || '',
      date: bon.date || new Date().toISOString().split('T')[0],
      montant: bon.montant != null ? String(bon.montant) : '',
      conducteurId: bon.conducteur_id || '',
      typeCarburant: bon.type_carburant || 'gasoil',
      vehiculeId: bon.vehicule_id || '',
      kmInitial: bon.km_initial != null ? String(bon.km_initial) : '',
      kmFinal: bon.km != null ? String(bon.km) : '',
      notes: bon.notes || '',
    });
    setIsDialogOpen(true);
  };

  const getDriverName = (bon: FuelVoucher) => {
    if (bon.employee) return `${bon.employee.prenom} ${bon.employee.nom}`;
    return '-';
  };

  const getVehicleName = (bon: FuelVoucher) => {
    if (bon.vehicle) return `${bon.vehicle.modele} (${bon.vehicle.matricule})`;
    return '-';
  };

  const filteredBons = useMemo(() => {
    return bons.filter((bon) => {
      if (filterVehicleId !== 'all' && bon.vehicule_id !== filterVehicleId) return false;
      if (filterDriverId !== 'all' && bon.conducteur_id !== filterDriverId) return false;
      return true;
    });
  }, [bons, filterVehicleId, filterDriverId]);

  const listResetKey = `${filterVehicleId}|${filterDriverId}`;
  const {
    slice: bonsPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(filteredBons, listResetKey);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 transition-colors">
            <Fuel className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Bons de Carburants</h2>
          </div>
        </div>
        <Button onClick={openNewDialog} className="gap-2 rounded-xl h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5 bg-primary text-primary-foreground border-none">
          <Plus className="w-5 h-5" />
          Nouveau Bon
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ClipboardList className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total Bons</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{filteredBons.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Banknote className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Montant Total</p>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {filteredBons.reduce((acc, b) => acc + (b.montant || 0), 0).toLocaleString()} <span className="text-sm text-muted-foreground font-normal">TND</span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border bg-muted/20">
            <div className="flex-1 space-y-1">
              <Label htmlFor="filter-voucher-vehicle" className="text-xs text-muted-foreground">
                Filtrer par véhicule
              </Label>
              <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
                <SelectTrigger id="filter-voucher-vehicle" className="h-10 rounded-xl bg-background">
                  <SelectValue placeholder="Tous les véhicules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les véhicules</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[v.constructeur, v.modele].filter(Boolean).join(' ') || v.modele} — {v.matricule}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="filter-voucher-driver" className="text-xs text-muted-foreground">
                Filtrer par chauffeur
              </Label>
              <Select value={filterDriverId} onValueChange={setFilterDriverId}>
                <SelectTrigger id="filter-voucher-driver" className="h-10 rounded-xl bg-background">
                  <SelectValue placeholder="Tous les chauffeurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les chauffeurs</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.prenom} {emp.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                <TableHead className="font-semibold text-foreground">Bon n°</TableHead>
                <TableHead className="font-semibold text-foreground">Véhicule</TableHead>
                <TableHead className="font-semibold text-foreground">Conducteur</TableHead>
                <TableHead className="font-semibold text-foreground">Carburant</TableHead>
                <TableHead className="font-semibold text-right text-foreground">Montant</TableHead>
                <TableHead className="font-semibold text-foreground">Date</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Km initial</TableHead>
                <TableHead className="font-semibold text-foreground">Km final</TableHead>
                <TableHead className="font-semibold text-foreground">Distance</TableHead>
                <TableHead className="font-semibold text-center text-foreground">Odomètre</TableHead>
                <TableHead className="font-semibold text-center text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBons.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>
                        {bons.length === 0
                          ? 'Aucun bon de carburant trouvé'
                          : 'Aucun bon ne correspond aux filtres'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                bonsPage.map((bon) => {
                  const kmFinal = resolveVoucherKmFinal(bon);
                  const distance = getVoucherDistance(bon);

                  return (
                    <TableRow key={bon.id} className="hover:bg-muted/50 transition-colors border-border">
                      <TableCell className="font-medium text-primary">{bon.num_bon}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-foreground">
                          <Car className="w-4 h-4 text-muted-foreground" />
                          {getVehicleName(bon)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-foreground">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {getDriverName(bon)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            bon.type_carburant === 'essence'
                              ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }
                        >
                          {bon.type_carburant || 'gasoil'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {(bon.montant || 0).toLocaleString()} TND
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatAppDate(bon.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={fuelVoucherStatusBadgeClass(bon.status)}>
                          {getFuelVoucherStatusDisplay(bon.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {bon.km_initial != null ? `${bon.km_initial.toLocaleString()} km` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {kmFinal != null ? `${kmFinal.toLocaleString()} km` : '-'}
                      </TableCell>
                      <TableCell className="text-foreground text-sm font-medium">
                        {distance != null ? `${distance.toLocaleString()} km` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {bon.proof_image_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedImage(bon.proof_image_url)}
                          >
                            <ImageIcon className="w-4 h-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            title="Modifier"
                            aria-label="Modifier le bon"
                            onClick={() => openEditDialog(bon)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Supprimer"
                              aria-label="Supprimer le bon"
                              onClick={() => setDeleteConfirm(bon)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingVoucherId(null);
            setKmInitialAutoFilled(false);
            setForm(emptyForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-primary text-primary-foreground">
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Fuel className="w-5 h-5" />
              </div>
              {editingVoucherId ? 'Modifier Bon de Carburant' : 'Nouveau Bon de Carburant'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numBon" className="text-sm font-semibold text-foreground">Numéro du Bon *</Label>
                <Input
                  id="numBon"
                  placeholder="Ex: BON-2024-001"
                  value={form.numBon}
                  onChange={(e) => setForm({ ...form, numBon: e.target.value })}
                  className="rounded-xl border-border bg-background focus:ring-primary/20 h-11 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-semibold text-foreground">Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="pl-10 rounded-xl border-border bg-background h-11 text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicule" className="text-sm font-semibold text-foreground">Véhicule *</Label>
                <Select value={form.vehiculeId} onValueChange={(v) => void handleVehicleChange(v)}>
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vehicles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun véhicule enregistré</div>
                    ) : (
                      vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.constructeur, v.modele].filter(Boolean).join(' ') || v.modele} — {v.matricule}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conducteur" className="text-sm font-semibold text-foreground">Conducteur *</Label>
                <Select
                  value={form.conducteurId}
                  onValueChange={(v) => setForm({ ...form, conducteurId: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {employees.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun employé enregistré</div>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.prenom} {emp.nom}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="montant" className="text-sm font-semibold text-foreground">Montant (TND) *</Label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <DecimalInput
                    id="montant"
                    value={parseFloat(form.montant) || 0}
                    onValueChange={(v) => setForm({ ...form, montant: String(v) })}
                    placeholder="0.00"
                    className="pl-10 rounded-xl border-border bg-background h-11 text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-semibold text-foreground">Carburant</Label>
                <Select
                  value={form.typeCarburant}
                  onValueChange={(v) => setForm({ ...form, typeCarburant: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="gasoil">Gasoil</SelectItem>
                    <SelectItem value="essence">Essence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Km initial</strong> — pour{' '}
                <strong className="text-foreground">ce véhicule</strong> uniquement : saisi manuellement au premier
                bon, puis repris du km final du dernier bon approuvé du même véhicule.
              </p>
              <p>
                <strong className="text-foreground">Km final</strong> — saisi par le chauffeur (app mobile) à
                l&apos;approbation. Distance = km final − km initial. La chaîne ne mélange jamais deux véhicules
                différents.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kmInitial" className="text-sm font-semibold text-foreground">
                  Km initial *
                </Label>
                <Input
                  id="kmInitial"
                  type="number"
                  placeholder="Premier bon : saisie manuelle"
                  value={form.kmInitial}
                  onChange={(e) => {
                    setKmInitialAutoFilled(false);
                    setForm({ ...form, kmInitial: e.target.value });
                  }}
                  className="rounded-xl border-border bg-background h-11 text-foreground"
                />
                {!editingVoucherId && form.vehiculeId && (
                  <p className="text-xs text-muted-foreground">
                    {kmInitialAutoFilled
                      ? 'Km initial repris du km final du dernier bon approuvé de ce véhicule (modifiable si besoin).'
                      : 'Premier bon pour ce véhicule : saisissez le km initial manuellement.'}
                  </p>
                )}
              </div>
              {editingVoucherId ? (
                <div className="space-y-2">
                  <Label htmlFor="kmFinal" className="text-sm font-semibold text-foreground">Km final</Label>
                  <Input
                    id="kmFinal"
                    type="number"
                    placeholder="Ex: 128450"
                    value={form.kmFinal}
                    onChange={(e) => setForm({ ...form, kmFinal: e.target.value })}
                    className="rounded-xl border-border bg-background h-11 text-foreground"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Km final</Label>
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 h-11 flex items-center px-3 text-sm text-muted-foreground">
                    Saisi par le chauffeur (app mobile)
                  </div>
                </div>
              )}
            </div>
            {form.kmInitial.trim() && form.kmFinal.trim() && (
              <p className="text-sm text-muted-foreground -mt-2">
                Distance :{' '}
                <span className="font-semibold text-foreground">
                  {(() => {
                    const d = computeFuelVoucherDistance(Number(form.kmFinal), Number(form.kmInitial));
                    if (d == null || Number.isNaN(d)) return '—';
                    return d >= 0 ? `${d.toLocaleString()} km` : 'Km final < km initial';
                  })()}
                </span>
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold text-foreground">Notes / Commentaires</Label>
              <textarea
                id="notes"
                placeholder="Informations complémentaires..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full min-h-[100px] p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 gap-3 border-t border-border">
            <Button variant="ghost" onClick={() => { setIsDialogOpen(false); setEditingVoucherId(null); setForm(emptyForm()); }} className="rounded-xl px-6 h-11 hover:bg-muted/50 text-muted-foreground transition-colors" disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all border-none" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                editingVoucherId ? 'Mettre à jour' : 'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de carburant ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  Le bon <strong>{deleteConfirm.num_bon}</strong> ({getVehicleName(deleteConfirm)},{' '}
                  {getDriverName(deleteConfirm)}) sera définitivement supprimé. Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none">
          {selectedImage && (
            <div className="relative group">
              <img 
                src={selectedImage} 
                alt="Odomètre" 
                className="w-full h-auto rounded-lg shadow-2xl"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <Button variant="secondary" onClick={() => window.open(selectedImage, '_blank')}>
                  <Eye className="w-4 h-4 mr-2" />
                  Ouvrir en plein écran
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

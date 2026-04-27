import { useState, useEffect } from 'react';
import { Fuel, Plus, Search, Calendar, User, Car, Banknote, ClipboardList, Loader2, Image as ImageIcon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  distance: number | null;
  proof_image_url: string | null;
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
}

export const BonCarburant = () => {
  const [bons, setBons] = useState<FuelVoucher[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [form, setForm] = useState({
    numBon: '',
    date: new Date().toISOString().split('T')[0],
    montant: '',
    conducteurId: '',
    typeCarburant: 'gasoil' as string,
    vehiculeId: '',
    notes: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bonsRes, empRes, vehRes] = await Promise.all([
        supabase
          .from('fuel_vouchers')
          .select('*, employee:employees(prenom, nom), vehicle:vehicles(modele, matricule)')
          .order('created_at', { ascending: false }),
        supabase.from('employees').select('id, prenom, nom').order('prenom'),
        supabase.from('vehicles').select('id, modele, matricule').order('modele'),
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
  }, []);

  const handleSubmit = async () => {
    if (!form.numBon || !form.montant || !form.conducteurId || !form.vehiculeId) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('fuel_vouchers')
        .insert([{
          num_bon: form.numBon.trim(),
          date: form.date,
          montant: parseFloat(form.montant),
          conducteur_id: form.conducteurId,
          vehicule_id: form.vehiculeId,
          type_carburant: form.typeCarburant,
          notes: form.notes.trim() || null,
          status: 'pending',
        }]);

      if (error) throw error;

      toast.success('Bon de carburant ajouté');
      setForm({
        numBon: '',
        date: new Date().toISOString().split('T')[0],
        montant: '',
        conducteurId: '',
        typeCarburant: 'gasoil',
        vehiculeId: '',
        notes: '',
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding voucher:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du bon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDriverName = (bon: FuelVoucher) => {
    if (bon.employee) return `${bon.employee.prenom} ${bon.employee.nom}`;
    return '-';
  };

  const getVehicleName = (bon: FuelVoucher) => {
    if (bon.vehicle) return `${bon.vehicle.modele} (${bon.vehicle.matricule})`;
    return '-';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 transition-colors">
            <Fuel className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Bons de Carburants</h2>
            <p className="text-muted-foreground">Gérez et suivez vos bons de consommation de carburant.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-xl h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5 bg-primary text-primary-foreground border-none">
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
          <p className="text-2xl font-bold text-foreground">{bons.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Banknote className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Montant Total</p>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {bons.reduce((acc, b) => acc + (b.montant || 0), 0).toLocaleString()} <span className="text-sm text-muted-foreground font-normal">TND</span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
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
                <TableHead className="font-semibold text-foreground">Km / Distance</TableHead>
                <TableHead className="font-semibold text-center text-foreground">Odomètre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bons.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>Aucun bon de carburant trouvé</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                bons.map((bon) => (
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
                      <Badge variant="outline" className={bon.type_carburant === 'essence' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}>
                        {bon.type_carburant || 'gasoil'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{(bon.montant || 0).toLocaleString()} TND</TableCell>
                    <TableCell className="text-foreground">{new Date(bon.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={bon.status === 'used' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}>
                        {bon.status === 'pending' ? 'En attente' : bon.status === 'used' ? 'Utilisé' : (bon.status || 'En attente')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {bon.km ? `${bon.km} km` : '-'} / {bon.distance ? `${bon.distance} km` : '-'}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-primary text-primary-foreground">
            <DialogTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Fuel className="w-5 h-5" />
              </div>
              Nouveau Bon de Carburant
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
                <Select
                  value={form.vehiculeId}
                  onValueChange={(v) => setForm({ ...form, vehiculeId: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vehicles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun véhicule enregistré</div>
                    ) : (
                      vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.modele} - {v.matricule}
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
                  <Input
                    id="montant"
                    type="number"
                    placeholder="0.00"
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: e.target.value })}
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
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl px-6 h-11 hover:bg-muted/50 text-muted-foreground transition-colors" disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all border-none" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

import { useState, useCallback } from 'react';
import { Fuel, Plus, Search, Filter, Calendar, User, Car, Banknote, ClipboardList } from 'lucide-react';
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

interface Bon {
  id: string;
  numBon: string;
  date: string;
  montant: string;
  conducteur: string;
  typeCarburant: 'essence' | 'gasoil';
  vehicule: string;
  notes: string;
  status: 'en_attente' | 'utilise';
  km?: string;
  distance?: string;
}

export const BonCarburant = () => {
  const [bons, setBons] = useState<Bon[]>(() => {
    const saved = localStorage.getItem('grosafe_bons');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Load data for selections
  const employees = JSON.parse(localStorage.getItem('grosafe_employees') || '[]');
  const vehicles = JSON.parse(localStorage.getItem('grosafe_vehicles') || '[]');
  const [form, setForm] = useState({
    numBon: '',
    date: new Date().toISOString().split('T')[0],
    montant: '',
    conducteur: '',
    typeCarburant: 'gasoil' as 'essence' | 'gasoil',
    vehicule: '',
    notes: '',
  });

  const saveBons = (newBons: Bon[]) => {
    setBons(newBons);
    localStorage.setItem('grosafe_bons', JSON.stringify(newBons));
  };

  const handleSubmit = useCallback(() => {
    if (!form.numBon || !form.montant || !form.conducteur || !form.vehicule) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newBon: Bon = {
      id: crypto.randomUUID(),
      ...form,
      status: 'en_attente',
    };

    saveBons([newBon, ...bons]);
    setIsDialogOpen(false);
    setForm({
      numBon: '',
      date: new Date().toISOString().split('T')[0],
      montant: '',
      conducteur: '',
      typeCarburant: 'gasoil',
      vehicule: '',
      notes: '',
    });
    toast.success('Bon de carburant ajouté');
  }, [form, bons]);

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
            {bons.reduce((acc, b) => acc + parseFloat(b.montant || '0'), 0).toLocaleString()} <span className="text-sm text-muted-foreground font-normal">TND</span>
          </p>
        </div>
      </div>

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
                  <TableCell className="font-medium text-primary">{bon.numBon}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-foreground">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      {bon.vehicule}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-foreground">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {bon.conducteur}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={bon.typeCarburant === 'essence' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}>
                      {bon.typeCarburant}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{parseFloat(bon.montant).toLocaleString()} TND</TableCell>
                  <TableCell className="text-foreground">{new Date(bon.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={bon.status === 'utilise' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}>
                      {bon.status === 'en_attente' ? 'En attente' : 'Utilisé'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {bon.km ? `${bon.km} km` : '-'} / {bon.distance ? `${bon.distance} km` : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                  value={form.vehicule}
                  onValueChange={(v) => setForm({ ...form, vehicule: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vehicles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun véhicule enregistré</div>
                    ) : (
                      vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={`${v.modele} (${v.matricule})`}>
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
                  value={form.conducteur}
                  onValueChange={(v) => setForm({ ...form, conducteur: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-background h-11 text-foreground">
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {employees.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun employé enregistré</div>
                    ) : (
                      employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={`${emp.prenom} ${emp.nom}`}>
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
                  onValueChange={(v: any) => setForm({ ...form, typeCarburant: v })}
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
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl px-6 h-11 hover:bg-muted/50 text-muted-foreground transition-colors">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all border-none">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

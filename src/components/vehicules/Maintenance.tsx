import { useState, useCallback, useEffect } from 'react';
import { Wrench, Plus, Calendar, Car, AlertTriangle, CheckCircle2, Clock, Search, Banknote } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceRecord {
  id: string;
  vehicule: string;
  vehiculeId?: string;
  description: string;
  type: 'preventive' | 'urgent' | 'corrective';
  dateDebut: string;
  coutEstime: string;
  notes: string;
  status: 'en_cours' | 'termine' | 'annule';
}

export const Maintenance = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('grosafe_maintenances');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Load vehicles from Supabase
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase.from('vehicles').select('id, modele, matricule');
      setVehicles(data || []);
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    localStorage.setItem('grosafe_maintenances', JSON.stringify(records));
  }, [records]);
  
  const [form, setForm] = useState({
    vehiculeId: '',
    description: '',
    type: 'preventive' as const,
    dateDebut: new Date().toISOString().split('T')[0],
    coutEstime: '',
    notes: '',
  });

  const handleSubmit = useCallback(() => {
    if (!form.vehiculeId || !form.description) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    const selectedVehicle = vehicles.find((v: any) => v.id === form.vehiculeId);
    const vehicleLabel = selectedVehicle
      ? `${selectedVehicle.modele} (${selectedVehicle.matricule})`
      : form.vehiculeId;

    const newRecord: MaintenanceRecord = {
      id: crypto.randomUUID(),
      vehicule: vehicleLabel,
      vehiculeId: form.vehiculeId,
      description: form.description,
      type: form.type,
      dateDebut: form.dateDebut,
      coutEstime: form.coutEstime,
      notes: form.notes,
      status: 'en_cours',
    };

    setRecords((prev) => [newRecord, ...prev]);
    void supabase
      .from('vehicles')
      .update({ statut: 'en_panne' })
      .eq('id', form.vehiculeId);
    setIsDialogOpen(false);
    setForm({
      vehiculeId: '',
      description: '',
      type: 'preventive',
      dateDebut: new Date().toISOString().split('T')[0],
      coutEstime: '',
      notes: '',
    });
    toast.success('Entretien enregistré');
  }, [form]);

  const getTypeStyles = (type: MaintenanceRecord['type']) => {
    switch (type) {
      case 'urgent': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'corrective': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'preventive': return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
    }
  };

  const getStatusIcon = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'en_cours': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'termine': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'annule': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Maintenances</h2>
            <p className="text-muted-foreground font-medium">Suivi des entretiens et réparations de la flotte.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-2xl h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5" />
          Nouvelle Maintenance
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Résumé Global</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">En cours</span>
                </div>
                <span className="text-xl font-black text-amber-500">{records.filter(r => r.status === 'en_cours').length}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Urgent</span>
                </div>
                <span className="text-xl font-black text-rose-500">{records.filter(r => r.type === 'urgent').length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl bg-muted/20 border-2 border-dashed border-border">
              <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center shadow-sm mb-6">
                <Wrench className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Aucun historique de maintenance</h3>
              <p className="text-muted-foreground max-w-xs mt-2">Enregistrez vos premières interventions pour commencer le suivi.</p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="group bg-card p-6 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{record.vehicule}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(record.dateDebut).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-xl px-3 py-1 font-bold uppercase text-[10px] tracking-wider ${getTypeStyles(record.type)}`}>
                    {record.type}
                  </Badge>
                </div>
                
                <h5 className="text-lg font-bold text-foreground mb-2">{record.description}</h5>
                <p className="text-sm text-muted-foreground mb-6 bg-muted/30 p-4 rounded-2xl line-clamp-2 italic">{record.notes || 'Aucune note supplémentaire.'}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-muted/50">
                      {getStatusIcon(record.status)}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                      {record.status === 'en_cours' ? 'Intervention en cours' : record.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Coût Estimé</p>
                    <p className="font-black text-foreground text-lg">{parseFloat(record.coutEstime || '0').toLocaleString()} <span className="text-xs opacity-50">TND</span></p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="p-10 bg-primary text-primary-foreground relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24" />
            <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-4 relative">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Wrench className="w-8 h-8" />
              </div>
              Nouvelle Intervention
            </DialogTitle>
          </DialogHeader>

          <div className="p-10 grid gap-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="vehicule" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Sélection du Véhicule *</Label>
                <Select
                  value={form.vehiculeId}
                  onValueChange={(v) => setForm({ ...form, vehiculeId: v })}
                >
                  <SelectTrigger className="rounded-2xl border-border bg-background h-14 font-semibold">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-card">
                    {vehicles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun véhicule enregistré</div>
                    ) : (
                      vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id} className="rounded-xl">
                          {v.modele} - {v.matricule}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="type" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Type de Maintenance</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: any) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="rounded-2xl border-border bg-background h-14 font-semibold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-card">
                    <SelectItem value="preventive" className="rounded-xl">Préventive</SelectItem>
                    <SelectItem value="corrective" className="rounded-xl">Corrective</SelectItem>
                    <SelectItem value="urgent" className="rounded-xl">URGENT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description de l'intervention *</Label>
              <Input
                id="description"
                placeholder="Ex: Vidange moteur + filtres"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-2xl border-border bg-background h-14 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="dateDebut" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Date de début</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="dateDebut"
                    type="date"
                    value={form.dateDebut}
                    onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                    className="pl-12 rounded-2xl border-border bg-background h-14 font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="cout" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Coût Estimé (TND)</Label>
                <div className="relative">
                  <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="cout"
                    type="number"
                    placeholder="0.00"
                    value={form.coutEstime}
                    onChange={(e) => setForm({ ...form, coutEstime: e.target.value })}
                    className="pl-12 rounded-2xl border-border bg-background h-14 font-semibold text-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="notes" className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Notes Additionnelles</Label>
              <textarea
                id="notes"
                placeholder="Détails, pièces à changer, garage..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full min-h-[120px] p-5 rounded-3xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm font-medium"
              />
            </div>
          </div>

          <DialogFooter className="p-10 bg-muted/30 flex flex-row justify-end gap-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl h-14 px-8 font-bold text-muted-foreground hover:bg-muted/50">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-2xl h-14 px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              Lancer l'Intervention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

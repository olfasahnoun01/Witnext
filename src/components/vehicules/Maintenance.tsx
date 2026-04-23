import { useState, useCallback } from 'react';
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

interface MaintenanceRecord {
  id: string;
  vehicule: string;
  description: string;
  type: 'preventive' | 'urgent' | 'corrective';
  dateDebut: string;
  coutEstime: string;
  notes: string;
  status: 'en_cours' | 'termine' | 'annule';
}

export const Maintenance = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Load vehicles for selection
  const vehicles = JSON.parse(localStorage.getItem('grosafe_vehicles') || '[]');
  const [form, setForm] = useState({
    vehicule: '',
    description: '',
    type: 'preventive' as const,
    dateDebut: new Date().toISOString().split('T')[0],
    coutEstime: '',
    notes: '',
  });

  const handleSubmit = useCallback(() => {
    if (!form.vehicule || !form.description) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    const newRecord: MaintenanceRecord = {
      id: crypto.randomUUID(),
      ...form,
      status: 'en_cours',
    };

    setRecords((prev) => [newRecord, ...prev]);
    setIsDialogOpen(false);
    setForm({
      vehicule: '',
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
      case 'urgent': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'corrective': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'preventive': return 'bg-sky-500/10 text-sky-600 border-sky-200';
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Maintenances</h2>
            <p className="text-slate-500 font-medium">Suivi des entretiens et réparations de la flotte.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-2xl h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5" />
          Nouvelle Maintenance
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Résumé Global</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-900">En cours</span>
                </div>
                <span className="text-xl font-black text-amber-600">{records.filter(r => r.status === 'en_cours').length}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span className="font-semibold text-rose-900">Urgent</span>
                </div>
                <span className="text-xl font-black text-rose-600">{records.filter(r => r.type === 'urgent').length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm mb-6">
                <Wrench className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Aucun historique de maintenance</h3>
              <p className="text-slate-500 max-w-xs mt-2">Enregistrez vos premières interventions pour commencer le suivi.</p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{record.vehicule}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(record.dateDebut).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-xl px-3 py-1 font-bold uppercase text-[10px] tracking-wider ${getTypeStyles(record.type)}`}>
                    {record.type}
                  </Badge>
                </div>
                
                <h5 className="text-lg font-bold text-slate-800 mb-2">{record.description}</h5>
                <p className="text-sm text-slate-500 mb-6 bg-slate-50/50 p-4 rounded-2xl line-clamp-2">{record.notes || 'Aucune note supplémentaire.'}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-slate-50">
                      {getStatusIcon(record.status)}
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                      {record.status === 'en_cours' ? 'Intervention en cours' : record.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Coût Estimé</p>
                    <p className="font-black text-slate-800 text-lg">{parseFloat(record.coutEstime || '0').toLocaleString()} <span className="text-xs opacity-50">TND</span></p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-10 bg-slate-900 text-white relative">
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
                <Label htmlFor="vehicule" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Sélection du Véhicule *</Label>
                <Select
                  value={form.vehicule}
                  onValueChange={(v) => setForm({ ...form, vehicule: v })}
                >
                  <SelectTrigger className="rounded-2xl border-slate-200 h-14 font-semibold">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    {vehicles.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center italic">Aucun véhicule enregistré</div>
                    ) : (
                      vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={`${v.modele} (${v.matricule})`} className="rounded-xl">
                          {v.modele} - {v.matricule}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="type" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Type de Maintenance</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: any) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="rounded-2xl border-slate-200 h-14 font-semibold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    <SelectItem value="preventive" className="rounded-xl">Préventive</SelectItem>
                    <SelectItem value="corrective" className="rounded-xl">Corrective</SelectItem>
                    <SelectItem value="urgent" className="rounded-xl">URGENT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Description de l'intervention *</Label>
              <Input
                id="description"
                placeholder="Ex: Vidange moteur + filtres"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-2xl border-slate-200 h-14 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="dateDebut" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date de début</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="dateDebut"
                    type="date"
                    value={form.dateDebut}
                    onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                    className="pl-12 rounded-2xl border-slate-200 h-14 font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="cout" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Coût Estimé (TND)</Label>
                <div className="relative">
                  <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="cout"
                    type="number"
                    placeholder="0.00"
                    value={form.coutEstime}
                    onChange={(e) => setForm({ ...form, coutEstime: e.target.value })}
                    className="pl-12 rounded-2xl border-slate-200 h-14 font-semibold text-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="notes" className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Notes Additionnelles</Label>
              <textarea
                id="notes"
                placeholder="Détails, pièces à changer, garage..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full min-h-[120px] p-5 rounded-3xl border border-slate-200 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all resize-none text-sm font-medium"
              />
            </div>
          </div>

          <DialogFooter className="p-10 bg-slate-50/50 flex flex-row justify-end gap-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl h-14 px-8 font-bold text-slate-400 hover:text-slate-600 hover:bg-white">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-2xl h-14 px-10 bg-slate-900 hover:bg-slate-800 text-white font-black shadow-xl shadow-slate-200">
              Lancer l'Intervention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

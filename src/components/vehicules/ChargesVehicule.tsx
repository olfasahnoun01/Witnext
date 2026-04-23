import { useState, useCallback } from 'react';
import { Receipt, Plus, Calendar, Car, Shield, FileCheck, Landmark, Trash2, AlertCircle } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Charge {
  id: string;
  vehicule: string;
  type: 'visite_technique' | 'assurance' | 'vignette';
  dateEcheance: string;
  montant: string;
  notes: string;
}

export const ChargesVehicule = () => {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    vehicule: '',
    type: 'assurance' as Charge['type'],
    dateEcheance: '',
    montant: '',
    notes: '',
  });

  const handleSubmit = useCallback(() => {
    if (!form.vehicule || !form.dateEcheance || !form.montant) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    const newCharge: Charge = {
      id: crypto.randomUUID(),
      ...form,
    };

    setCharges((prev) => [...prev, newCharge]);
    setIsDialogOpen(false);
    setForm({
      vehicule: '',
      type: 'assurance',
      dateEcheance: '',
      montant: '',
      notes: '',
    });
    toast.success('Charge annuelle enregistrée');
  }, [form]);

  const deleteCharge = (id: string) => {
    setCharges(prev => prev.filter(c => c.id !== id));
    toast.success('Charge supprimée');
  };

  const getChargeIcon = (type: Charge['type']) => {
    switch (type) {
      case 'visite_technique': return <FileCheck className="w-6 h-6 text-indigo-600" />;
      case 'assurance': return <Shield className="w-6 h-6 text-emerald-600" />;
      case 'vignette': return <Landmark className="w-6 h-6 text-amber-600" />;
    }
  };

  const getChargeLabel = (type: Charge['type']) => {
    switch (type) {
      case 'visite_technique': return 'Visite Technique';
      case 'assurance': return 'Assurance / Contrat';
      case 'vignette': return 'Vignettes / Taxes';
    }
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
            <Receipt className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Charges Annuelles</h2>
            <p className="text-slate-500">Suivi des visites techniques, assurances et vignettes.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-2xl h-14 px-8 bg-slate-900 border-none shadow-xl shadow-slate-200">
          <Plus className="w-5 h-5" />
          Ajouter une Charge
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {charges.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-sm mb-8">
              <Receipt className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Aucune charge annuelle enregistrée</h3>
            <p className="text-slate-500 max-w-sm text-center mt-3">
              Suivez les échéances de vos véhicules pour éviter les amendes et les retards de paiements.
            </p>
          </div>
        ) : (
          charges.map((charge) => (
            <Card key={charge.id} className={`rounded-[2rem] border-none shadow-lg overflow-hidden transition-all hover:scale-[1.02] ${isExpired(charge.dateEcheance) ? 'bg-rose-50/50 ring-1 ring-rose-200' : 'bg-white'}`}>
              <CardContent className="p-0">
                <div className="p-6 flex items-start justify-between">
                  <div className={`p-4 rounded-2xl ${
                    charge.type === 'assurance' ? 'bg-emerald-500/10' : 
                    charge.type === 'visite_technique' ? 'bg-indigo-500/10' : 
                    'bg-amber-500/10'
                  }`}>
                    {getChargeIcon(charge.type)}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteCharge(charge.id)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="px-8 pb-8 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <Car className="w-4 h-4 text-slate-400" />
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{charge.vehicule}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight">
                      {getChargeLabel(charge.type)}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Montant</p>
                      <p className="font-bold text-slate-800">{parseFloat(charge.montant).toLocaleString()} TND</p>
                    </div>
                    <div className={`p-4 rounded-2xl ${isExpired(charge.dateEcheance) ? 'bg-rose-500 text-white' : 'bg-slate-50'}`}>
                      <p className={`text-[10px] font-bold uppercase mb-1 ${isExpired(charge.dateEcheance) ? 'text-white/70' : 'text-slate-400'}`}>Échéance</p>
                      <p className={`font-bold ${isExpired(charge.dateEcheance) ? 'text-white' : 'text-slate-800'}`}>
                        {new Date(charge.dateEcheance).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {isExpired(charge.dateEcheance) && (
                    <div className="flex items-center gap-2 text-rose-600 bg-rose-500/10 p-3 rounded-xl border border-rose-200">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Attention : Échéance dépassée</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase pl-1">Notes</p>
                    <p className="text-sm text-slate-500 leading-relaxed pl-1 italic">
                      {charge.notes || 'Aucun détail précisé.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <Receipt className="w-6 h-6" />
              Ajouter une Charge
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase pl-1">Véhicule concerné *</Label>
                <Input
                  placeholder="Ex: Toyota TN-1234"
                  value={form.vehicule}
                  onChange={(e) => setForm({ ...form, vehicule: e.target.value })}
                  className="rounded-2xl border-slate-200 h-12 font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase pl-1">Type de dépense</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: any) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="rounded-2xl border-slate-200 h-12 font-semibold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="assurance">Assurance / Contrat</SelectItem>
                    <SelectItem value="visite_technique">Visite Technique</SelectItem>
                    <SelectItem value="vignette">Vignettes / Taxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase pl-1">Montant (TND) *</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: e.target.value })}
                    className="rounded-2xl border-slate-200 h-12 font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase pl-1">Date d'échéance *</Label>
                  <Input
                    type="date"
                    value={form.dateEcheance}
                    onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
                    className="rounded-2xl border-slate-200 h-12 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase pl-1">Notes</Label>
                <textarea
                  placeholder="Numéro de contrat, compagnie, etc."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all resize-none text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50/50 flex flex-row justify-end gap-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl h-12 px-6 font-bold text-slate-400">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-2xl h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-200">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

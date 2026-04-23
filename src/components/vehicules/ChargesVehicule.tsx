import { useState, useCallback, useEffect } from 'react';
import { Receipt, Plus, Car, Shield, FileCheck, Landmark, Trash2, AlertCircle, Bell, CreditCard } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface Charge {
  id: string;
  vehicule: string;
  type: 'visite_technique' | 'assurance' | 'vignette' | 'leasing';
  dateEcheance: string;
  montant: string;
  notes: string;
  provider?: string;
  contractNumber?: string;
  reminderDate?: string;
  valeurTotale?: string;
  montantPaye?: string;
}

export const ChargesVehicule = () => {
  const [charges, setCharges] = useState<Charge[]>(() => {
    const saved = localStorage.getItem('grosafe_charges_vehicules');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assurance' | 'vignette' | 'visite_technique' | 'leasing'>('assurance');
  
  // Load vehicles for selection
  const vehicles = JSON.parse(localStorage.getItem('grosafe_vehicles') || '[]');
  
  useEffect(() => {
    localStorage.setItem('grosafe_charges_vehicules', JSON.stringify(charges));
  }, [charges]);
  
  const [form, setForm] = useState<Partial<Charge>>({
    vehicule: '',
    type: 'assurance',
    dateEcheance: '',
    montant: '',
    notes: '',
    provider: '',
    contractNumber: '',
    reminderDate: '',
    valeurTotale: '',
    montantPaye: '',
  });

  const handleOpenDialog = () => {
    setForm({
      vehicule: '',
      type: activeTab,
      dateEcheance: '',
      montant: '',
      notes: '',
      provider: '',
      contractNumber: '',
      reminderDate: '',
      valeurTotale: '',
      montantPaye: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = useCallback(() => {
    if (!form.vehicule || !form.dateEcheance || !form.montant) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    if (form.type === 'assurance' && (!form.provider || !form.contractNumber)) {
      toast.error('Veuillez remplir les informations d\'assurance (Compagnie et N° de contrat)');
      return;
    }

    if (form.type === 'leasing' && (!form.valeurTotale || !form.montantPaye)) {
      toast.error('Veuillez remplir les informations de leasing (Valeur de la voiture et Montant payé)');
      return;
    }

    const newCharge: Charge = {
      id: crypto.randomUUID(),
      ...(form as any),
    };

    setCharges((prev) => [...prev, newCharge]);
    setIsDialogOpen(false);
    toast.success('Charge enregistrée avec succès');
  }, [form]);

  const deleteCharge = (id: string) => {
    setCharges(prev => prev.filter(c => c.id !== id));
    toast.success('Charge supprimée');
  };

  const getChargeIcon = (type: Charge['type']) => {
    switch (type) {
      case 'visite_technique': return <FileCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
      case 'assurance': return <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'vignette': return <Landmark className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case 'leasing': return <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getChargeLabel = (type: Charge['type']) => {
    switch (type) {
      case 'visite_technique': return 'Visite Technique';
      case 'assurance': return 'Assurance / Contrat';
      case 'vignette': return 'Vignettes / Taxes';
      case 'leasing': return 'Leasing Automobile';
    }
  };

  const isExpired = (date: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isReminderDue = (date: string) => {
    if (!date) return false;
    return new Date(date) <= new Date();
  };

  const filteredCharges = charges.filter(charge => charge.type === activeTab);

  const renderChargeCard = (charge: Charge) => (
    <Card key={charge.id} className={`rounded-[2rem] border-none shadow-lg overflow-hidden transition-all hover:scale-[1.02] ${isExpired(charge.dateEcheance) ? 'bg-rose-500/10 ring-1 ring-rose-500/20' : 'bg-card'}`}>
      <CardContent className="p-0">
        <div className="p-6 flex items-start justify-between">
          <div className={`p-4 rounded-2xl ${
            charge.type === 'assurance' ? 'bg-emerald-500/10' : 
            charge.type === 'visite_technique' ? 'bg-indigo-500/10' : 
            charge.type === 'leasing' ? 'bg-blue-500/10' :
            'bg-amber-500/10'
          }`}>
            {getChargeIcon(charge.type)}
          </div>
          <Button variant="ghost" size="sm" onClick={() => deleteCharge(charge.id)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <Car className="w-4 h-4 text-muted-foreground" />
               <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{charge.vehicule}</span>
            </div>
            <h3 className="text-xl font-black text-foreground leading-tight">
              {getChargeLabel(charge.type)}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-4 rounded-2xl">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                {charge.type === 'leasing' ? 'Mensualité' : 'Montant'}
              </p>
              <p className="font-bold text-foreground">{parseFloat(charge.montant).toLocaleString()} TND</p>
            </div>
            <div className={`p-4 rounded-2xl ${isExpired(charge.dateEcheance) ? 'bg-rose-500 text-white' : 'bg-muted/30'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isExpired(charge.dateEcheance) ? 'text-white/70' : 'text-muted-foreground'}`}>
                {charge.type === 'leasing' ? 'Prochaine Échéance' : 'Échéance'}
              </p>
              <p className={`font-bold ${isExpired(charge.dateEcheance) ? 'text-white' : 'text-foreground'}`}>
                {new Date(charge.dateEcheance).toLocaleDateString()}
              </p>
            </div>
          </div>

          {charge.type === 'assurance' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Compagnie</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">{charge.provider}</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">N° Contrat</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">{charge.contractNumber}</p>
              </div>
            </div>
          )}

          {charge.type === 'leasing' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Valeur Totale</p>
                <p className="font-bold text-blue-600 dark:text-blue-400">{parseFloat(charge.valeurTotale || '0').toLocaleString()} TND</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Reste à payer</p>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {Math.max(0, parseFloat(charge.valeurTotale || '0') - parseFloat(charge.montantPaye || '0')).toLocaleString()} TND
                </p>
              </div>
            </div>
          )}

          {isExpired(charge.dateEcheance) && (
            <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Attention : Échéance dépassée</span>
            </div>
          )}

          {charge.reminderDate && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${isReminderDue(charge.reminderDate) ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'}`}>
              <Bell className={`w-4 h-4 ${isReminderDue(charge.reminderDate) ? 'animate-bounce' : ''}`} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isReminderDue(charge.reminderDate) ? 'Rappel en cours !' : 'Rappel programmé'} : {new Date(charge.reminderDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {charge.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase pl-1">Notes</p>
              <p className="text-sm text-muted-foreground/80 leading-relaxed pl-1 italic">
                {charge.notes}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Receipt className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Charges Annuelles & Leasing</h2>
            <p className="text-muted-foreground">Suivi des assurances, vignettes, visites et financements.</p>
          </div>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2 rounded-2xl h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5" />
          Ajouter
        </Button>
      </div>

      <Tabs defaultValue="assurance" value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-muted/50 p-1.5 rounded-2xl h-auto md:h-16 mb-8 gap-2">
          <TabsTrigger value="assurance" className="rounded-xl h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-emerald-500 text-sm font-bold transition-all text-muted-foreground">
            <Shield className="w-4 h-4 mr-2" />
            Assurances
          </TabsTrigger>
          <TabsTrigger value="vignette" className="rounded-xl h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-amber-500 text-sm font-bold transition-all text-muted-foreground">
            <Landmark className="w-4 h-4 mr-2" />
            Vignettes
          </TabsTrigger>
          <TabsTrigger value="visite_technique" className="rounded-xl h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-indigo-500 text-sm font-bold transition-all text-muted-foreground">
            <FileCheck className="w-4 h-4 mr-2" />
            Visites
          </TabsTrigger>
          <TabsTrigger value="leasing" className="rounded-xl h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-blue-500 text-sm font-bold transition-all text-muted-foreground">
            <CreditCard className="w-4 h-4 mr-2" />
            Leasing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assurance" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCharges.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border">
                <Shield className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">Aucune assurance enregistrée</h3>
                <p className="text-muted-foreground max-w-sm text-center mt-2 text-sm">
                  Ajoutez vos contrats d'assurance pour configurer des rappels avant leur expiration.
                </p>
              </div>
            ) : (
              filteredCharges.map(renderChargeCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="vignette" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCharges.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border">
                <Landmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">Aucune vignette enregistrée</h3>
                <p className="text-muted-foreground max-w-sm text-center mt-2 text-sm">
                  Gérez les taxes de circulation de vos véhicules et soyez rappelé à temps.
                </p>
              </div>
            ) : (
              filteredCharges.map(renderChargeCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="visite_technique" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCharges.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border">
                <FileCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">Aucune visite technique</h3>
                <p className="text-muted-foreground max-w-sm text-center mt-2 text-sm">
                  Planifiez les visites techniques annuelles de votre flotte.
                </p>
              </div>
            ) : (
              filteredCharges.map(renderChargeCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="leasing" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCharges.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border">
                <CreditCard className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">Aucun leasing enregistré</h3>
                <p className="text-muted-foreground max-w-sm text-center mt-2 text-sm">
                  Gérez les financements de vos véhicules et suivez les échéances mensuelles.
                </p>
              </div>
            ) : (
              filteredCharges.map(renderChargeCard)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader className={`p-8 text-white ${
            form.type === 'assurance' ? 'bg-emerald-600' : 
            form.type === 'visite_technique' ? 'bg-indigo-600' : 
            form.type === 'leasing' ? 'bg-blue-600' :
            'bg-amber-600'
          }`}>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {form.type === 'assurance' && <Shield className="w-6 h-6" />}
              {form.type === 'vignette' && <Landmark className="w-6 h-6" />}
              {form.type === 'visite_technique' && <FileCheck className="w-6 h-6" />}
              {form.type === 'leasing' && <CreditCard className="w-6 h-6" />}
              Ajouter : {getChargeLabel(form.type as any)}
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Véhicule concerné *</Label>
                <Select
                  value={form.vehicule}
                  onValueChange={(v) => setForm({ ...form, vehicule: v })}
                >
                  <SelectTrigger className="rounded-2xl border-border bg-background h-12 font-semibold">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-card border-border">
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

              {form.type === 'assurance' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Compagnie d'assurance *</Label>
                    <Input
                      placeholder="Ex: STAR, COMAR..."
                      value={form.provider || ''}
                      onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      className="rounded-2xl border-border bg-background h-12 font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">N° Contrat *</Label>
                    <Input
                      placeholder="Numéro de police"
                      value={form.contractNumber || ''}
                      onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                      className="rounded-2xl border-border bg-background h-12 font-semibold"
                    />
                  </div>
                </div>
              )}

              {form.type === 'leasing' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Valeur de la voiture (TND) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.valeurTotale || ''}
                      onChange={(e) => setForm({ ...form, valeurTotale: e.target.value })}
                      className="rounded-2xl border-border bg-background h-12 font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Montant déjà payé (TND) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.montantPaye || ''}
                      onChange={(e) => setForm({ ...form, montantPaye: e.target.value })}
                      className="rounded-2xl border-border bg-background h-12 font-semibold"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">
                    {form.type === 'leasing' ? 'Mensualité (TND) *' : 'Montant (TND) *'}
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: e.target.value })}
                    className="rounded-2xl border-border bg-background h-12 font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">
                    {form.type === 'leasing' ? 'Prochaine Échéance *' : 'Date d\'échéance *'}
                  </Label>
                  <Input
                    type="date"
                    value={form.dateEcheance}
                    onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
                    className="rounded-2xl border-border bg-background h-12 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-2 bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-indigo-500" />
                  <Label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Rappel de paiement</Label>
                </div>
                <Input
                  type="date"
                  value={form.reminderDate || ''}
                  onChange={(e) => setForm({ ...form, reminderDate: e.target.value })}
                  className="rounded-2xl border-indigo-500/20 bg-background h-12 font-semibold text-indigo-600 dark:text-indigo-400"
                />
                <p className="text-[10px] text-indigo-400 mt-1 pl-1">Définissez une date pour recevoir une notification avant l'échéance.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Notes additionnelles</Label>
                <textarea
                  placeholder="Informations supplémentaires..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full min-h-[80px] p-4 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/30 flex flex-row justify-end gap-3 border-t border-border">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl h-12 px-6 font-bold text-muted-foreground hover:bg-muted/50 transition-colors">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="rounded-2xl h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

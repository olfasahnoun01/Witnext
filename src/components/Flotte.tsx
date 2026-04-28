import { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Trash2, Hash, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Vehicle {
  id: string;
  modele: string;
  matricule: string;
  type?: string;
}

export const Flotte = () => {
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ modele: '', matricule: '', type: '' });

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      toast.error('Erreur lors du chargement des véhicules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;

    const timeoutId = window.setTimeout(() => {
      firstInputRef.current?.focus();
      firstInputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [isDialogOpen]);

  const handleSubmit = async () => {
    if (!form.modele.trim() || !form.matricule.trim()) {
      toast.error('Le modèle et la matricule sont obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .insert([{
          modele: form.modele.trim(),
          matricule: form.matricule.trim(),
          type: form.type.trim() || null,
        }]);

      if (error) throw error;

      toast.success(`Véhicule « ${form.modele} » ajouté`);
      setForm({ modele: '', matricule: '', type: '' });
      setIsDialogOpen(false);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du véhicule');
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
      setVehicles(vehicles.filter((v) => v.id !== id));
      toast.success('Véhicule supprimé');
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
          onClick={() => setIsDialogOpen(true)}
          className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="w-4 h-4" />
          Ajouter Véhicule
        </Button>
      </div>

      {/* List */}
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
          <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            Ajouter un véhicule
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, idx) => (
            <div
              key={v.id}
              className="group relative p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-200"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Delete btn */}
              <button
                onClick={() => handleDelete(v.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground shadow mb-3">
                <Truck className="w-5 h-5" />
              </div>

              <h3 className="font-semibold text-foreground text-base truncate mb-2">{v.modele}</h3>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5" />
                  <span>{v.matricule}</span>
                </div>
                {v.type && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{v.type}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Vehicle Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Ajouter un Véhicule
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="veh-modele">Modèle *</Label>
              <Input
                id="veh-modele"
                ref={firstInputRef}
                placeholder="Ex: Toyota Hilux"
                value={form.modele}
                onChange={(e) => setForm((f) => ({ ...f, modele: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="veh-matricule">Matricule *</Label>
              <Input
                id="veh-matricule"
                placeholder="Ex: 123 TUN 4567"
                value={form.matricule}
                onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="veh-type">Type</Label>
              <Input
                id="veh-type"
                placeholder="Ex: Camion, Voiture..."
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              />
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
                  Ajout...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

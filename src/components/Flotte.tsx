import { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Trash2, Hash, Loader2, Gauge, Fuel } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Vehicle {
  id: string;
  modele: string;
  matricule: string;
  type?: string | null;
  constructeur?: string | null;
  type_carburant?: string | null;
  kilometrage_actuel?: number | null;
}

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
  'Mercedes-Benz',
  'Land Rover',
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

const plateDigits = (raw: string, maxLen: number) => raw.replace(/\D/g, '').slice(0, maxLen);

const buildMatriculeTunisie = (region: string, serial: string) => {
  const r = plateDigits(region, 3);
  const s = plateDigits(serial, 4);
  return `${r} TUN ${s}`;
};

const vehicleTitle = (v: Vehicle) => {
  const c = (v.constructeur || '').trim();
  const m = (v.modele || '').trim();
  if (c && m) return `${c} ${m}`;
  return m || c || 'Véhicule';
};

const carburantLabel = (v: string | null | undefined) => {
  if (!v) return '—';
  if (v === 'gasoil') return 'Gasoil';
  if (v === 'essence') return 'Essence';
  return v;
};

export const Flotte = () => {
  const modeleInputRef = useRef<HTMLInputElement | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    constructeur: '' as string,
    constructeurCustom: '',
    modele: '',
    categorie: '',
    kilometrage_actuel: '',
    type_carburant: 'gasoil' as 'gasoil' | 'essence',
  });
  const [plateRegion, setPlateRegion] = useState('');
  const [plateSerial, setPlateSerial] = useState('');

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
      modeleInputRef.current?.focus();
      modeleInputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [isDialogOpen]);

  const openAddDialog = () => {
    setForm({
      constructeur: '',
      constructeurCustom: '',
      modele: '',
      categorie: '',
      kilometrage_actuel: '',
      type_carburant: 'gasoil',
    });
    setPlateRegion('');
    setPlateSerial('');
    setIsDialogOpen(true);
  };

  const resolvedConstructeur = () => {
    if (!form.constructeur) return '';
    if (form.constructeur === 'Autre') return form.constructeurCustom.trim();
    return form.constructeur;
  };

  const handleSubmit = async () => {
    const brand = resolvedConstructeur();
    if (!brand) {
      toast.error('Sélectionnez ou saisissez un constructeur');
      return;
    }
    if (!form.modele.trim()) {
      toast.error('Le modèle est obligatoire');
      return;
    }
    const r = plateDigits(plateRegion, 3);
    const s = plateDigits(plateSerial, 4);
    if (r.length < 2 || s.length < 2) {
      toast.error('Indiquez le numéro régional (gauche) et le numéro d\'immatriculation (droite), ex. 123 TUN 4567');
      return;
    }
    const matricule = buildMatriculeTunisie(r, s);
    const kmRaw = form.kilometrage_actuel.trim().replace(',', '.');
    const km = kmRaw === '' ? 0 : parseFloat(kmRaw);
    if (Number.isNaN(km) || km < 0) {
      toast.error('Kilométrage actuel invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        constructeur: brand,
        modele: form.modele.trim(),
        matricule,
        type_carburant: form.type_carburant,
        kilometrage_actuel: km,
      };
      const cat = form.categorie.trim();
      if (cat) payload.type = cat;

      const { error } = await supabase.from('vehicles').insert([payload as never]);

      if (error) throw error;

      toast.success(`Véhicule « ${brand} ${form.modele.trim()} » ajouté`);
      setForm({
        constructeur: '',
        constructeurCustom: '',
        modele: '',
        categorie: '',
        kilometrage_actuel: '',
        type_carburant: 'gasoil',
      });
      setPlateRegion('');
      setPlateSerial('');
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, idx) => (
            <div
              key={v.id}
              className="group relative p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-200"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <button
                onClick={() => handleDelete(v.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground shadow mb-3">
                <Truck className="w-5 h-5" />
              </div>

              <h3 className="font-semibold text-foreground text-base truncate mb-2">{vehicleTitle(v)}</h3>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="inline-flex items-center rounded-md border-2 border-foreground/80 bg-white px-2 py-0.5 font-mono font-semibold tracking-wider text-foreground dark:bg-muted">
                    {v.matricule}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-foreground/90">
                  <Fuel className="w-3.5 h-3.5 shrink-0" />
                  <span>{carburantLabel(v.type_carburant)}</span>
                </div>
                {v.kilometrage_actuel != null && (
                  <div className="flex items-center gap-2 text-foreground/90">
                    <Gauge className="w-3.5 h-3.5 shrink-0" />
                    <span>{Number(v.kilometrage_actuel).toLocaleString('fr-FR')} km</span>
                  </div>
                )}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Ajouter un Véhicule
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Constructeur *</Label>
              <Select
                value={form.constructeur || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, constructeur: v, constructeurCustom: v === 'Autre' ? f.constructeurCustom : '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une marque" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {CONSTRUCTEURS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.constructeur === 'Autre' && (
                <Input
                  placeholder="Nom du constructeur"
                  value={form.constructeurCustom}
                  onChange={(e) => setForm((f) => ({ ...f, constructeurCustom: e.target.value }))}
                  className="mt-1"
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="veh-modele">Modèle *</Label>
              <Input
                id="veh-modele"
                ref={modeleInputRef}
                placeholder="Ex: Golf 8, Hilux, Clio V…"
                value={form.modele}
                onChange={(e) => setForm((f) => ({ ...f, modele: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Type de carburant *</Label>
              <Select
                value={form.type_carburant}
                onValueChange={(v) => setForm((f) => ({ ...f, type_carburant: v as 'gasoil' | 'essence' }))}
              >
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
              <Label>Immatriculation (Tunisie) *</Label>
              <p className="text-xs text-muted-foreground">Format plaque : numéro régional · TUN · numéro (ex. 123 TUN 4567)</p>
              <div className="flex items-stretch gap-2">
                <Input
                  id="veh-plate-region"
                  inputMode="numeric"
                  placeholder="123"
                  className="text-center font-mono tracking-widest max-w-[5.5rem]"
                  value={plateRegion}
                  onChange={(e) => setPlateRegion(plateDigits(e.target.value, 3))}
                  maxLength={3}
                />
                <div className="flex items-center justify-center rounded-md border-2 border-foreground/70 bg-muted/40 px-3 font-bold text-sm tracking-tight text-foreground shrink-0">
                  TUN
                </div>
                <Input
                  id="veh-plate-serial"
                  inputMode="numeric"
                  placeholder="4567"
                  className="text-center font-mono tracking-widest flex-1 min-w-0"
                  value={plateSerial}
                  onChange={(e) => setPlateSerial(plateDigits(e.target.value, 4))}
                  maxLength={4}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="veh-km">Kilométrage actuel (km) *</Label>
              <Input
                id="veh-km"
                inputMode="decimal"
                placeholder="Ex: 45230"
                value={form.kilometrage_actuel}
                onChange={(e) => setForm((f) => ({ ...f, kilometrage_actuel: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="veh-categorie">Catégorie (optionnel)</Label>
              <Input
                id="veh-categorie"
                placeholder="Ex: Camion, Fourgon, Voiture…"
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
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

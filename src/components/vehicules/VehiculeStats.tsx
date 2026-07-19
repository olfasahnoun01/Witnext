import { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart3, Car, Fuel, Wrench, Receipt, Users, Calendar as CalendarIcon, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { loadMaintenanceRecords } from '@/lib/vehicleMaintenanceStorage';
import { loadVehicleCharges } from '@/lib/vehicleChargesStorage';

const CHART_COLORS = ['#10b981', '#f97316', '#3b82f6', '#ec4899', '#8b5cf6', '#eab308', '#06b6d4', '#64748b', '#ef4444', '#84cc16'];

export const VehiculeStats = () => {
  const [activeTab, setActiveTab] = useState<'voiture' | 'chauffeur'>('voiture');
  
  // Default date range: Last 30 days
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [selectedVehicule, setSelectedVehicule] = useState<string>('all');
  const [selectedChauffeur, setSelectedChauffeur] = useState<string>('all');

  // Load data from Supabase + localStorage
  const [vehicules, setVehicules] = useState<any[]>([]);
  const [employes, setEmployes] = useState<any[]>([]);
  const [bons, setBons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Maintenance/charges: same localStorage keys as Maintenance.tsx / ChargesVehicule.tsx
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);

  const loadLocalVehicleData = useCallback(async () => {
    const companyId = getActiveCompanyId();
    const [maintenancesData, chargesData] = await Promise.all([
      loadMaintenanceRecords(companyId),
      loadVehicleCharges(companyId),
    ]);
    setMaintenances(maintenancesData);
    setCharges(chargesData);
  }, []);

  useEffect(() => {
    void loadLocalVehicleData();
  }, [loadLocalVehicleData]);

  useCompanyChangeReload(() => {
    void loadLocalVehicleData();
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [vehRes, empRes, bonsRes] = await Promise.all([
          supabase.from('vehicles').select('*'),
          supabase.from('employees').select('*'),
          supabase.from('fuel_vouchers').select('*, employee:employees(prenom, nom), vehicle:vehicles(modele, matricule)'),
        ]);
        setVehicules(vehRes.data || []);
        setEmployes(empRes.data || []);
        setBons(bonsRes.data || []);
      } catch (error) {
        console.error('Error loading stats data:', error);
        toast.error('Erreur lors du chargement des statistiques véhicules');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const isWithinDateRange = useCallback((dateStr: string) => {
    if (!dateDebut || !dateFin || !dateStr) return true;
    const d = new Date(dateStr);
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }, [dateDebut, dateFin]);

  // --- STATS PAR VOITURE ---
  const statsVoiture = useMemo(() => {
    const filterVehicule = (id: string) => selectedVehicule === 'all' || id === selectedVehicule;

    const filteredBons = bons.filter((b: any) => filterVehicule(b.vehicule_id) && isWithinDateRange(b.date as string));
    const filteredMaintenances = maintenances.filter((m: any) => {
      const inRange = isWithinDateRange(m.dateDebut as string);
      if (selectedVehicule === 'all') return inRange;
      if (m.vehiculeId) return m.vehiculeId === selectedVehicule && inRange;
      const veh = vehicules.find((v: any) => v.id === selectedVehicule);
      const vehName = veh ? `${veh.modele} (${veh.matricule})` : '';
      return m.vehicule === vehName && inRange;
    });
    const filteredCharges = charges.filter((c: any) => {
      const veh = vehicules.find((v: any) => v.id === selectedVehicule);
      const vehName = veh ? `${veh.modele} (${veh.matricule})` : '';
      return (selectedVehicule === 'all' || c.vehicule === vehName) && isWithinDateRange(c.dateEcheance as string);
    });

    const totalCarburantTND = filteredBons.reduce((acc: number, b: any) => acc + (b.montant || 0), 0);
    const totalDistance = filteredBons.reduce((acc: number, b: any) => acc + (b.distance || 0), 0);
    const totalMaintenanceTND = filteredMaintenances.reduce((acc: number, m: any) => acc + parseFloat(m.coutEstime || '0'), 0);
    
    // Group charges by type
    const chargesByType = filteredCharges.reduce((acc: any, c: any) => {
      const montant = parseFloat(c.montant || '0');
      if (!acc[c.type]) acc[c.type] = 0;
      acc[c.type] += montant;
      acc.total += montant;
      return acc;
    }, { total: 0, assurance: 0, vignette: 0, visite_technique: 0, leasing: 0 });

    const totalGeneral = totalCarburantTND + totalMaintenanceTND + chargesByType.total;

    return {
      carburant: totalCarburantTND,
      distance: totalDistance,
      maintenance: totalMaintenanceTND,
      nbPannes: filteredMaintenances.length,
      charges: chargesByType,
      totalGeneral,
      nbBons: filteredBons.length
    };
  }, [selectedVehicule, dateDebut, dateFin, bons, maintenances, charges, vehicules, isWithinDateRange]);

  // --- STATS PAR CHAUFFEUR ---
  const statsChauffeur = useMemo(() => {
    const filterChauffeur = (id: string) => selectedChauffeur === 'all' || id === selectedChauffeur;

    const filteredBons = bons.filter((b: any) => filterChauffeur(b.conducteur_id) && isWithinDateRange(b.date as string));

    const totalCarburantTND = filteredBons.reduce((acc: number, b: any) => acc + (b.montant || 0), 0);
    const totalDistance = filteredBons.reduce((acc: number, b: any) => acc + (b.distance || 0), 0);

    return {
      carburant: totalCarburantTND,
      distance: totalDistance,
      nbBons: filteredBons.length
    };
  }, [selectedChauffeur, dateDebut, dateFin, bons, isWithinDateRange]);

  const bonsFiltresVoiture = useMemo(() => {
    const filterVehicule = (id: string) => selectedVehicule === 'all' || id === selectedVehicule;
    return bons.filter((b: any) => filterVehicule(b.vehicule_id) && isWithinDateRange(b.date as string));
  }, [bons, selectedVehicule, isWithinDateRange]);

  const repartitionCoutsPie = useMemo(() => {
    const s = statsVoiture;
    const rows = [
      { name: 'Carburant', value: s.carburant },
      { name: 'Maintenance', value: s.maintenance },
      { name: 'Assurance', value: s.charges.assurance || 0 },
      { name: 'Vignette', value: s.charges.vignette || 0 },
      { name: 'Visite technique', value: s.charges.visite_technique || 0 },
      { name: 'Leasing', value: s.charges.leasing || 0 },
    ].filter((r) => r.value > 0);
    return rows;
  }, [statsVoiture]);

  const carburantParMoisVoiture = useMemo(() => {
    const map = new Map<string, number>();
    bonsFiltresVoiture.forEach((b: any) => {
      const raw = b.date;
      if (!raw) return;
      const key = String(raw).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      map.set(key, (map.get(key) || 0) + (Number(b.montant) || 0));
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, montant]) => {
        const [y, m] = ym.split('-');
        return { label: `${m}/${y.slice(2)}`, montant };
      });
  }, [bonsFiltresVoiture]);

  const bonsFiltresChauffeur = useMemo(() => {
    const filterChauffeur = (id: string) => selectedChauffeur === 'all' || id === selectedChauffeur;
    return bons.filter((b: any) => filterChauffeur(b.conducteur_id) && isWithinDateRange(b.date as string));
  }, [bons, selectedChauffeur, isWithinDateRange]);

  const carburantParChauffeur = useMemo(() => {
    if (selectedChauffeur !== 'all') return [];
    const map = new Map<string, { name: string; montant: number }>();
    bonsFiltresChauffeur.forEach((b: any) => {
      const id = b.conducteur_id || '—';
      const name = b.employee ? `${b.employee.prenom} ${b.employee.nom}`.trim() : 'Conducteur';
      const prev = map.get(id);
      const add = Number(b.montant) || 0;
      map.set(id, { name: prev?.name || name, montant: (prev?.montant || 0) + add });
    });
    return [...map.values()].sort((a, b) => b.montant - a.montant).slice(0, 10);
  }, [bonsFiltresChauffeur, selectedChauffeur]);

  const carburantParMoisChauffeur = useMemo(() => {
    const map = new Map<string, number>();
    bonsFiltresChauffeur.forEach((b: any) => {
      const raw = b.date;
      if (!raw) return;
      const key = String(raw).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      map.set(key, (map.get(key) || 0) + (Number(b.montant) || 0));
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, montant]) => {
        const [y, m] = ym.split('-');
        return { label: `${m}/${y.slice(2)}`, montant };
      });
  }, [bonsFiltresChauffeur]);

  const tndTooltip = (v: number | undefined) => [`${(v ?? 0).toLocaleString('fr-FR')} TND`, ''];

  const carburantParTypeChauffeur = useMemo(() => {
    let gasoil = 0;
    let essence = 0;
    bonsFiltresChauffeur.forEach((b: any) => {
      const m = Number(b.montant) || 0;
      const t = String(b.type_carburant || 'gasoil').toLowerCase();
      if (t === 'essence') essence += m;
      else gasoil += m;
    });
    return [
      { name: 'Gasoil', value: gasoil },
      { name: 'Essence', value: essence },
    ].filter((r) => r.value > 0);
  }, [bonsFiltresChauffeur]);

  const tooltipTheme = {
    contentStyle: {
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '12px',
      fontSize: '12px',
    },
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/5">
            <BarChart3 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Statistiques de la Flotte</h2>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Période du</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="pl-10 rounded-2xl h-12 font-medium bg-background border-border"
            />
          </div>
        </div>
        <div className="flex-1 w-full space-y-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Au</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="pl-10 rounded-2xl h-12 font-medium bg-background border-border"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="voiture" value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1.5 rounded-2xl h-14 mb-8">
          <TabsTrigger value="voiture" className="rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm font-bold transition-all data-[state=active]:text-foreground text-muted-foreground">
            <Car className="w-4 h-4 mr-2" />
            Par Voiture
          </TabsTrigger>
          <TabsTrigger value="chauffeur" className="rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm font-bold transition-all data-[state=active]:text-foreground text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            Par Chauffeur
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voiture" className="mt-0 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Sélectionner un véhicule</Label>
            <Select value={selectedVehicule} onValueChange={setSelectedVehicule}>
              <SelectTrigger className="rounded-2xl h-14 font-bold text-lg border-border bg-background">
                <SelectValue placeholder="Tous les véhicules" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-card border-border">
                <SelectItem value="all" className="font-bold">Tous les véhicules (Global)</SelectItem>
                {vehicules.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.modele} - {v.matricule}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Coût Total</p>
                </div>
                <p className="text-3xl font-black text-foreground">{statsVoiture.totalGeneral.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">TND</span></p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Carburant + Maintenance + Charges</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500">
                    <Fuel className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carburant</p>
                </div>
                <p className="text-3xl font-black text-foreground">{statsVoiture.carburant.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">TND</span></p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Via {statsVoiture.nbBons} bon(s)</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                    <Car className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Distance</p>
                </div>
                <p className="text-3xl font-black text-foreground">{statsVoiture.distance.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">KM</span></p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Parcourus dans la période</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Maintenances</p>
                </div>
                <p className="text-3xl font-black text-foreground">{statsVoiture.maintenance.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">TND</span></p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">{statsVoiture.nbPannes} intervention(s) / pannes</p>
              </CardContent>
            </Card>
          </div>

          {!isLoading && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[2rem] border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground">Répartition des coûts (TND)</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">Carburant, maintenance et charges sur la période</p>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {repartitionCoutsPie.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée de coût sur cette période
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={repartitionCoutsPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={100}
                          paddingAngle={2}
                          strokeWidth={2}
                          className="stroke-background"
                        >
                          {repartitionCoutsPie.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => tndTooltip(v)} {...tooltipTheme} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground">Carburant par mois (TND)</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">Somme des bons sur la période filtrée</p>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {carburantParMoisVoiture.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucun bon de carburant sur cette période
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carburantParMoisVoiture} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}`} />
                        <Tooltip formatter={(v: number) => tndTooltip(v)} labelFormatter={(l) => `Mois ${l}`} {...tooltipTheme} />
                        <Bar dataKey="montant" fill="#f97316" radius={[6, 6, 0, 0]} name="Montant" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="rounded-[2.5rem] border-none shadow-md bg-card p-2">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Détail des Charges & Leasings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/30 p-6 rounded-3xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Total Assurances</p>
                  <p className="text-xl font-black text-emerald-500">{statsVoiture.charges.assurance.toLocaleString()} TND</p>
                </div>
                <div className="bg-muted/30 p-6 rounded-3xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Total Vignettes</p>
                  <p className="text-xl font-black text-amber-500">{statsVoiture.charges.vignette.toLocaleString()} TND</p>
                </div>
                <div className="bg-muted/30 p-6 rounded-3xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Visites Techniques</p>
                  <p className="text-xl font-black text-indigo-500">{statsVoiture.charges.visite_technique.toLocaleString()} TND</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl">
                  <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">Total Leasing</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{statsVoiture.charges.leasing.toLocaleString()} TND</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chauffeur" className="mt-0 space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase pl-1">Sélectionner un chauffeur</Label>
            <Select value={selectedChauffeur} onValueChange={setSelectedChauffeur}>
              <SelectTrigger className="rounded-2xl h-14 font-bold text-lg border-border bg-background">
                <SelectValue placeholder="Tous les chauffeurs" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-card border-border">
                <SelectItem value="all" className="font-bold">Tous les chauffeurs (Global)</SelectItem>
                {employes.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-600">
                    <Fuel className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carburant Consommé</p>
                </div>
                <p className="text-4xl font-black text-foreground">{statsChauffeur.carburant.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">TND</span></p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Via {statsChauffeur.nbBons} bon(s) de carburant</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-md bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
                    <Car className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Distance Parcourue</p>
                </div>
                <p className="text-4xl font-black text-foreground">{statsChauffeur.distance.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">KM</span></p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Total des distances déclarées</p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-md bg-card flex items-center justify-center p-8 bg-muted/20 border-2 border-dashed border-border">
               <div className="text-center">
                 <AlertCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                 <p className="text-sm font-bold text-muted-foreground">Note d'information</p>
                 <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">Les maintenances et charges sont liées aux véhicules, pas aux chauffeurs.</p>
               </div>
            </Card>
          </div>

          {!isLoading && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[2rem] border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground">Carburant par mois (TND)</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">Bons filtrés (chauffeur / période)</p>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {carburantParMoisChauffeur.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucun bon sur cette période
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={carburantParMoisChauffeur} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(v: number) => tndTooltip(v)} {...tooltipTheme} />
                        <Bar dataKey="montant" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Montant" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-foreground">
                    {selectedChauffeur === 'all' ? 'Carburant par conducteur' : 'Répartition gasoil / essence'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">
                    {selectedChauffeur === 'all' ? 'Top 10 (TND) sur la période' : 'Montants TND des bons sélectionnés'}
                  </p>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {selectedChauffeur === 'all' ? (
                    carburantParChauffeur.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée conducteur
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={carburantParChauffeur} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip formatter={(v: number) => tndTooltip(v)} {...tooltipTheme} />
                          <Bar dataKey="montant" fill="#10b981" radius={[0, 6, 6, 0]} name="Montant" />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : carburantParTypeChauffeur.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={carburantParTypeChauffeur}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={2}
                          strokeWidth={2}
                          className="stroke-background"
                        >
                          {carburantParTypeChauffeur.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => tndTooltip(v)} {...tooltipTheme} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

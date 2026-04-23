import { useState, useMemo } from 'react';
import { BarChart3, Car, Fuel, Wrench, Receipt, Users, Calendar as CalendarIcon, TrendingUp, AlertCircle, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  // Load data from localStorage
  const vehicules = useMemo(() => JSON.parse(localStorage.getItem('grosafe_vehicles') || '[]'), []);
  const employes = useMemo(() => JSON.parse(localStorage.getItem('grosafe_employees') || '[]'), []);
  const bons = useMemo(() => JSON.parse(localStorage.getItem('grosafe_bons') || '[]'), []);
  const maintenances = useMemo(() => JSON.parse(localStorage.getItem('grosafe_maintenances') || '[]'), []);
  const charges = useMemo(() => JSON.parse(localStorage.getItem('grosafe_charges_vehicules') || '[]'), []);

  // Helper function to check if a date falls within the selected range
  const isWithinDateRange = (dateStr: string) => {
    if (!dateDebut || !dateFin || !dateStr) return true;
    const d = new Date(dateStr);
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    // Add 1 day to end date to make it inclusive
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  };

  // --- STATS PAR VOITURE ---
  const statsVoiture = useMemo(() => {
    const filterVehicule = (v: string) => selectedVehicule === 'all' || v === selectedVehicule;

    const filteredBons = bons.filter((b: any) => filterVehicule(b.vehicule) && isWithinDateRange(b.date));
    const filteredMaintenances = maintenances.filter((m: any) => filterVehicule(m.vehicule) && isWithinDateRange(m.dateDebut));
    const filteredCharges = charges.filter((c: any) => filterVehicule(c.vehicule) && isWithinDateRange(c.dateEcheance));

    const totalCarburantTND = filteredBons.reduce((acc: number, b: any) => acc + parseFloat(b.montant || '0'), 0);
    const totalDistance = filteredBons.reduce((acc: number, b: any) => acc + parseFloat(b.distance || '0'), 0);
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
  }, [selectedVehicule, dateDebut, dateFin, bons, maintenances, charges]);

  // --- STATS PAR CHAUFFEUR ---
  const statsChauffeur = useMemo(() => {
    const filterChauffeur = (c: string) => selectedChauffeur === 'all' || c === selectedChauffeur;

    const filteredBons = bons.filter((b: any) => filterChauffeur(b.conducteur) && isWithinDateRange(b.date));

    const totalCarburantTND = filteredBons.reduce((acc: number, b: any) => acc + parseFloat(b.montant || '0'), 0);
    const totalDistance = filteredBons.reduce((acc: number, b: any) => acc + parseFloat(b.distance || '0'), 0);

    return {
      carburant: totalCarburantTND,
      distance: totalDistance,
      nbBons: filteredBons.length
    };
  }, [selectedChauffeur, dateDebut, dateFin, bons]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/5">
            <BarChart3 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Statistiques de la Flotte</h2>
            <p className="text-muted-foreground">Analysez la consommation, les coûts et les performances.</p>
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
                  <SelectItem key={v.id} value={`${v.modele} (${v.matricule})`}>
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
                  <SelectItem key={emp.id} value={`${emp.prenom} ${emp.nom}`}>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

import { BarChart3, TrendingUp, Fuel, Wrench, AlertCircle, Car, Users, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const VehiculeStats = () => {
  const stats = [
    { title: 'Total Véhicules', value: '12', icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Consommation (L)', value: '1,240', icon: Fuel, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Dépenses Totales', value: '45,800 TND', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Maintenances en cours', value: '3', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/10">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Statistiques de la Flotte</h2>
          <p className="text-muted-foreground">Analyse globale des performances et des coûts.</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-md rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">{stat.value}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[2.5rem] border-none shadow-lg bg-white p-8">
          <CardHeader className="px-0 pt-0 pb-6">
             <CardTitle className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Évolution des Coûts Carburant
             </CardTitle>
          </CardHeader>
          <div className="h-[300px] w-full bg-slate-50 rounded-[2rem] flex items-center justify-center border border-dashed border-slate-200">
             <div className="flex flex-col items-center gap-3 text-slate-400 italic">
                <BarChart3 className="w-12 h-12 opacity-20" />
                <p>Graphique de consommation (Bientôt disponible)</p>
             </div>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-lg bg-white p-8">
          <CardHeader className="px-0 pt-0 pb-6">
             <CardTitle className="text-xl font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Alertes & Rappels
             </CardTitle>
          </CardHeader>
          <div className="space-y-4">
             {[
               { label: 'Assurance expire dans 5 jours', car: 'Dacia Duster - TN 4567', type: 'error' },
               { label: 'Visite technique demain', car: 'Toyota Hilux - TN 1234', type: 'warning' },
               { label: 'Vidange prévue (KM atteint)', car: 'Isuzu D-Max - TN 8890', type: 'info' },
             ].map((alert, i) => (
               <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className={`p-2 rounded-xl mt-1 ${
                    alert.type === 'error' ? 'bg-rose-100 text-rose-600' : 
                    alert.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                    'bg-sky-100 text-sky-600'
                  }`}>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{alert.label}</p>
                    <p className="text-xs text-slate-500 font-medium">{alert.car}</p>
                  </div>
               </div>
             ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

import { useState, useEffect, useRef } from 'react';
import { 
  Fuel, 
  CreditCard, 
  User, 
  History, 
  PlusCircle, 
  ArrowLeft, 
  LayoutDashboard, 
  QrCode, 
  Bell, 
  TrendingUp,
  MapPin,
  Clock,
  CheckCircle2,
  Car,
  Camera,
  X,
  Upload,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export const DriverMobileView = () => {
  const [view, setView] = useState<'home' | 'bons' | 'cards' | 'activity'>('home');
  const [driverName, setDriverName] = useState('');
  
  // App State from localStorage
  const [bons, setBons] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [myBons, setMyBons] = useState<any[]>([]);
  const [myCard, setMyCard] = useState<any>(null);
  
  // Use Bon Dialog State
  const [selectedBon, setSelectedBon] = useState<any>(null);
  const [isUseBonDialogOpen, setIsUseBonDialogOpen] = useState(false);
  const [kmInitial, setKmInitial] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const employees = JSON.parse(localStorage.getItem('grosafe_employees') || '[]');
    const currentDriver = employees[0] ? `${employees[0].prenom} ${employees[0].nom}` : 'Conducteur Démo';
    setDriverName(currentDriver);

    const allBons = JSON.parse(localStorage.getItem('grosafe_bons') || '[]');
    setBons(allBons);
    setMyBons(allBons.filter((b: any) => b.conducteur === currentDriver));

    const allCards = JSON.parse(localStorage.getItem('grosafe_fuel_cards') || '[]');
    setCards(allCards);
    setMyCard(allCards.find((c: any) => c.conducteur === currentDriver));
  }, [view]);

  const handleOpenUseBon = (bon: any) => {
    setSelectedBon(bon);
    
    // Check if it's the first time for this vehicle
    const kmHistory = JSON.parse(localStorage.getItem('grosafe_km_history') || '{}');
    const lastKm = kmHistory[bon.vehicule];
    
    if (lastKm) {
      setIsFirstTime(false);
      setKmInitial(lastKm);
    } else {
      setIsFirstTime(true);
      setKmInitial('');
    }
    
    setKmFinal('');
    setPhoto(null);
    setIsUseBonDialogOpen(true);
  };

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmUse = () => {
    if (!kmFinal || !photo) {
      toast.error('Veuillez saisir le KM final et prendre une photo');
      return;
    }

    if (parseFloat(kmFinal) <= parseFloat(kmInitial)) {
      toast.error('Le KM final doit être supérieur au KM initial');
      return;
    }

    // Update Bon Status
    const allBons = JSON.parse(localStorage.getItem('grosafe_bons') || '[]');
    const updatedBons = allBons.map((b: any) => 
      b.id === selectedBon.id ? { ...b, status: 'utilise', km: kmFinal, distance: (parseFloat(kmFinal) - parseFloat(kmInitial)).toString() } : b
    );
    localStorage.setItem('grosafe_bons', JSON.stringify(updatedBons));

    // Update KM History
    const kmHistory = JSON.parse(localStorage.getItem('grosafe_km_history') || '{}');
    kmHistory[selectedBon.vehicule] = kmFinal;
    localStorage.setItem('grosafe_km_history', JSON.stringify(kmHistory));

    // Update Vehicle Plate KM in Flotte
    const vehicles = JSON.parse(localStorage.getItem('grosafe_vehicles') || '[]');
    const updatedVehicles = vehicles.map((v: any) => 
      `${v.modele} (${v.matricule})` === selectedBon.vehicule ? { ...v, kmActuelle: kmFinal } : v
    );
    localStorage.setItem('grosafe_vehicles', JSON.stringify(updatedVehicles));

    toast.success('Bon utilisé avec succès');
    setIsUseBonDialogOpen(false);
    setView('home'); 
  };

  const renderHome = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Welcome Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Salut, {driverName.split(' ')[0]}! 👋</h1>
          <p className="text-slate-500 text-sm font-medium">Bonne route aujourd'hui.</p>
        </div>
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm">
            <User className="text-slate-400 w-6 h-6" />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full" />
        </div>
      </div>

      {/* Fuel Card Widget */}
      {myCard ? (
        <Card className="rounded-[2.5rem] border-none bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-2xl" />
          <CardContent className="p-8 relative">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Mon Solde Carburant</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-black">{parseFloat(myCard.solde).toFixed(3)}</h2>
                  <span className="text-sm font-bold opacity-70">TND</span>
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
            <div className="flex justify-between items-center bg-white/10 -mx-8 px-8 py-4 backdrop-blur-sm">
              <p className="text-xs font-mono opacity-80">{myCard.numCarte}</p>
              <Badge className="bg-emerald-400 text-emerald-950 hover:bg-emerald-400 border-none px-3 font-bold text-[10px]">ACTIVE</Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[2.5rem] border-none bg-slate-100 p-8 text-center border-2 border-dashed border-slate-200">
           <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-400 text-sm font-medium">Aucune carte assignée</p>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setView('bons')}
          className="h-28 rounded-[2.5rem] bg-amber-50 hover:bg-amber-100 border-none flex flex-col items-center justify-center gap-3 group transition-all"
        >
          <div className="p-3 rounded-2xl bg-amber-500 text-white group-hover:scale-110 transition-transform shadow-lg shadow-amber-200">
            <Fuel className="w-6 h-6" />
          </div>
          <span className="text-amber-900 font-black text-[10px] uppercase tracking-widest">Utiliser un Bon</span>
        </button>
        <button 
          onClick={() => toast.info('Scanner QR Code (Bientôt)')}
          className="h-28 rounded-[2.5rem] bg-sky-50 hover:bg-sky-100 border-none flex flex-col items-center justify-center gap-3 group transition-all"
        >
          <div className="p-3 rounded-2xl bg-sky-500 text-white group-hover:scale-110 transition-transform shadow-lg shadow-sky-200">
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-sky-900 font-black text-[10px] uppercase tracking-widest">Scanner QR</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Activités Récentes</h3>
          <button className="text-indigo-600 text-[10px] font-bold uppercase" onClick={() => setView('activity')}>Tout voir</button>
        </div>
        <div className="space-y-3">
          {myBons.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-sm italic">Aucune activité récente</p>
          ) : (
            myBons.slice(0, 3).map(bon => (
              <div key={bon.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 shadow-sm">
                <div className={`p-3 rounded-2xl ${bon.status === 'utilise' ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-500'}`}>
                  <Fuel className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Bon {bon.numBon}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{bon.vehicule}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${bon.status === 'utilise' ? 'text-slate-400' : 'text-slate-800'}`}>-{bon.montant}</p>
                  <p className="text-[10px] text-slate-300 font-bold uppercase">{bon.status === 'utilise' ? 'Utilisé' : 'Disponible'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderBons = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setView('home')} className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-xl font-black text-slate-800">Mes Bons</h2>
      </div>

      <div className="space-y-4">
        {myBons.length === 0 ? (
          <div className="text-center py-20">
             <Fuel className="w-12 h-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-medium">Aucun bon assigné</p>
          </div>
        ) : (
          myBons.map(bon => (
            <Card key={bon.id} className={`rounded-[2.5rem] border-none shadow-md overflow-hidden ${bon.status === 'utilise' ? 'opacity-60 bg-slate-50' : 'bg-white ring-1 ring-emerald-100'}`}>
              <CardContent className="p-0">
                <div className={`px-6 py-4 flex justify-between items-center ${bon.status === 'utilise' ? 'bg-slate-200/50' : 'bg-emerald-500 text-white'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{bon.status === 'utilise' ? 'UTILISÉ' : 'DISPONIBLE'}</span>
                  <span className="text-xs font-mono opacity-80">{bon.numBon}</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Montant</p>
                      <p className="text-2xl font-black text-slate-800">{bon.montant} <span className="text-xs">TND</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</p>
                      <p className="text-sm font-bold text-slate-600">{new Date(bon.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                    <Car className="w-5 h-5 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-600">{bon.vehicule}</span>
                  </div>
                  {bon.status === 'en_attente' && (
                    <Button 
                      onClick={() => handleOpenUseBon(bon)}
                      className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200"
                    >
                      Utiliser maintenant
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans pb-32">
      {/* Mobile-ized container */}
      <div className="max-w-md mx-auto p-6 md:pt-12">
        {view === 'home' && renderHome()}
        {view === 'bons' && renderBons()}
        {view === 'activity' && (
          <div className="animate-in slide-in-from-right-4 duration-400">
             <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setView('home')} className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h2 className="text-xl font-black text-slate-800">Historique</h2>
            </div>
            <div className="space-y-3">
               {myBons.filter(b => b.status === 'utilise').map(bon => (
                 <div key={bon.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                    <div>
                       <p className="font-bold text-slate-800">{bon.numBon}</p>
                       <p className="text-[10px] text-slate-400">{bon.vehicule}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-rose-500">-{bon.montant} TND</p>
                       <p className="text-[10px] font-bold text-slate-300">{bon.km} KM</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Use Bon Dialog */}
      <Dialog open={isUseBonDialogOpen} onOpenChange={setIsUseBonDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-black">Utilisation du Bon</DialogTitle>
            <button onClick={() => setIsUseBonDialogOpen(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>
          
          <div className="p-8 space-y-6">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <p className="text-xs font-bold text-amber-700">Véhicule: {selectedBon?.vehicule}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KM Initial</Label>
                <Input 
                  value={kmInitial}
                  onChange={(e) => isFirstTime && setKmInitial(e.target.value)}
                  disabled={!isFirstTime}
                  className="rounded-2xl border-slate-200 h-12 font-bold bg-slate-50"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">KM Final *</Label>
                <Input 
                  placeholder="0"
                  value={kmFinal}
                  onChange={(e) => setKmFinal(e.target.value)}
                  className="rounded-2xl border-indigo-200 h-12 font-bold focus:ring-indigo-500/20"
                  type="number"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo du compteur *</Label>
              {photo ? (
                <div className="relative rounded-3xl overflow-hidden aspect-video border-2 border-indigo-500">
                  <img src={photo} alt="Compteur" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setPhoto(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-[2rem] aspect-video flex flex-col items-center justify-center bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="p-4 rounded-full bg-white shadow-sm mb-3">
                    <Camera className="w-8 h-8 text-indigo-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">Prendre une photo</p>
                  <p className="text-[9px] text-slate-300 uppercase tracking-tight mt-1">Appareil photo uniquement</p>
                </div>
              )}
              {/* Hidden file input with "capture" attribute for camera only */}
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={handleCapturePhoto}
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50/50 flex flex-col gap-3">
             <Button 
               onClick={handleConfirmUse}
               disabled={!kmFinal || !photo}
               className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-200 disabled:opacity-50"
             >
               Confirmer l'utilisation
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Premium Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-40 pointer-events-none">
        <div className="max-w-md mx-auto h-20 bg-slate-900/95 backdrop-blur-lg rounded-[2.5rem] shadow-2xl shadow-slate-300 flex items-center justify-around px-4 pointer-events-auto border border-white/5">
          <button 
            onClick={() => setView('home')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'home' ? 'text-white' : 'text-slate-500'}`}
          >
            <div className={`p-2 rounded-xl ${view === 'home' ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : ''}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Accueil</span>
          </button>

          <button 
            onClick={() => setView('bons')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'bons' ? 'text-white' : 'text-slate-500'}`}
          >
            <div className={`p-2 rounded-xl ${view === 'bons' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : ''}`}>
              <Fuel className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Bons</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-500 active:scale-90 transition-all">
            <div className="p-3 -mt-16 bg-white rounded-full shadow-2xl border-4 border-slate-50">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white">
                <QrCode className="w-6 h-6" />
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Scan</span>
          </button>

          <button 
            onClick={() => setView('activity')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'activity' ? 'text-white' : 'text-slate-500'}`}
          >
            <div className={`p-2 rounded-xl ${view === 'activity' ? 'bg-sky-500 shadow-lg shadow-sky-500/20' : ''}`}>
              <History className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Activité</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-500">
            <div className="p-2 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
};

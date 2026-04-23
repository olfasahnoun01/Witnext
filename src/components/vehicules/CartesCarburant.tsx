import { useState, useCallback } from 'react';
import { CreditCard, Plus, History, RefreshCw, User, Wallet, MoreVertical, Trash2 } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface FuelCard {
  id: string;
  numCarte: string;
  conducteur: string;
  solde: number;
}

export const CartesCarburant = () => {
  const [cards, setCards] = useState<FuelCard[]>([]);
  const [isNewCardDialogOpen, setIsNewCardDialogOpen] = useState(false);
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<FuelCard | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  
  const [newCardForm, setNewCardForm] = useState({
    numCarte: '',
    conducteur: '',
    solde: '',
  });

  const handleCreateCard = useCallback(() => {
    if (!newCardForm.numCarte || !newCardForm.conducteur) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    const newCard: FuelCard = {
      id: crypto.randomUUID(),
      numCarte: newCardForm.numCarte,
      conducteur: newCardForm.conducteur,
      solde: parseFloat(newCardForm.solde || '0'),
    };

    setCards((prev) => [...prev, newCard]);
    setIsNewCardDialogOpen(false);
    setNewCardForm({ numCarte: '', conducteur: '', solde: '' });
    toast.success('Carte de carburant créée');
  }, [newCardForm]);

  const handleRecharge = useCallback(() => {
    if (!selectedCard || !rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      toast.error('Montant invalide');
      return;
    }

    setCards((prev) => prev.map(c => 
      c.id === selectedCard.id 
        ? { ...c, solde: c.solde + parseFloat(rechargeAmount) } 
        : c
    ));

    toast.success(`Carte rechargée de ${rechargeAmount} TND`);
    setIsRechargeDialogOpen(false);
    setRechargeAmount('');
    setSelectedCard(null);
  }, [selectedCard, rechargeAmount]);

  const handleDeleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter(c => c.id !== id));
    toast.success('Carte supprimée');
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10">
            <CreditCard className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cartes Carburants</h2>
            <p className="text-muted-foreground">Gestion des cartes de crédit carburant des conducteurs.</p>
          </div>
        </div>
        <Button onClick={() => setIsNewCardDialogOpen(true)} className="gap-2 rounded-xl h-12 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
          <Plus className="w-5 h-5" />
          Créer une Carte
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl border-2 border-dashed border-muted bg-muted/20">
          <div className="p-6 rounded-3xl bg-indigo-500/5 mb-6">
            <CreditCard className="w-12 h-12 text-indigo-600/30" />
          </div>
          <h3 className="text-xl font-bold mb-2">Aucune carte enregistrée</h3>
          <p className="text-muted-foreground max-w-sm mb-8">
            Enregistrez les cartes de carburant pour suivre les dépenses de vos conducteurs.
          </p>
          <Button variant="outline" onClick={() => setIsNewCardDialogOpen(true)} className="gap-2 rounded-2xl px-8 h-12 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
            Commencer maintenant
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 font-sans">
          {cards.map((card) => (
            <div key={card.id} className="group relative overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              {/* Background gradient deco */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
              
              <div className="p-6 relative">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-100 p-1">
                      <DropdownMenuItem className="gap-2 text-slate-600 rounded-lg cursor-pointer">
                        <History className="w-4 h-4" />
                        Historique complet
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteCard(card.id)} className="gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                        Supprimer la carte
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Numéro de Carte</p>
                    <p className="text-lg font-mono font-medium text-slate-700">{card.numCarte}</p>
                  </div>
                  
                  <div className="space-y-0.5 pb-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Conducteur</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-500/70" />
                      <p className="font-semibold text-slate-600">{card.conducteur}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Solde Actuel</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800">{card.solde.toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-400">TND</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-2xl h-10 gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 group/btn"
                    onClick={() => {
                        setSelectedCard(card);
                        setIsRechargeDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-500" />
                    Recharger
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-2xl h-10 gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200">
                    <History className="w-3.5 h-3.5" />
                    Historique
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Card Dialog */}
      <Dialog open={isNewCardDialogOpen} onOpenChange={setIsNewCardDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-indigo-600 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <CreditCard className="w-6 h-6" />
              Nouvelle Carte Carburant
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numCarte" className="text-sm font-bold text-slate-600 uppercase tracking-tight">Numéro de la Carte</Label>
                <Input
                  id="numCarte"
                  placeholder="Ex: 8600 0000 1234 5678"
                  value={newCardForm.numCarte}
                  onChange={(e) => setNewCardForm({ ...newCardForm, numCarte: e.target.value })}
                  className="rounded-2xl border-slate-200 h-12 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conducteur" className="text-sm font-bold text-slate-600 uppercase tracking-tight">Nom du Conducteur</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="conducteur"
                    placeholder="Saisir le nom"
                    value={newCardForm.conducteur}
                    onChange={(e) => setNewCardForm({ ...newCardForm, conducteur: e.target.value })}
                    className="pl-11 rounded-2xl border-slate-200 h-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="solde" className="text-sm font-bold text-slate-600 uppercase tracking-tight">Solde Initial (Optionnel)</Label>
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="solde"
                    type="number"
                    placeholder="0.00"
                    value={newCardForm.solde}
                    onChange={(e) => setNewCardForm({ ...newCardForm, solde: e.target.value })}
                    className="pl-11 rounded-2xl border-slate-200 h-12"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 gap-4">
            <Button variant="ghost" onClick={() => setIsNewCardDialogOpen(false)} className="rounded-2xl h-12 px-6">
              Annuler
            </Button>
            <Button onClick={handleCreateCard} className="bg-indigo-600 hover:bg-indigo-700 rounded-2xl h-12 px-8 shadow-lg shadow-indigo-200">
              Créer la Carte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recharge Dialog */}
      <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-green-600 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <RefreshCw className="w-6 h-6" />
              Recharger la Carte
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-700/60 uppercase mb-1">Carte de</p>
                <p className="text-lg font-bold text-green-800">{selectedCard?.conducteur}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-green-700/60 uppercase mb-1">Solde Actuel</p>
                <p className="text-lg font-mono font-bold text-green-800">{selectedCard?.solde.toLocaleString()} TND</p>
              </div>
            </div>
            <div className="space-y-3 pt-4">
              <Label htmlFor="rechargeAmount" className="text-sm font-bold text-slate-600 uppercase">Montant de la recharge (TND)</Label>
              <Input
                id="rechargeAmount"
                type="number"
                placeholder="Entrez le montant"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                autoFocus
                className="rounded-2xl border-slate-200 h-14 text-xl font-bold text-center focus:ring-green-500/20"
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 gap-4">
            <Button variant="ghost" onClick={() => setIsRechargeDialogOpen(false)} className="rounded-2xl h-12 px-6">
              Annuler
            </Button>
            <Button onClick={handleRecharge} className="bg-green-600 hover:bg-green-700 rounded-2xl h-12 px-8 shadow-lg shadow-green-200">
              Confirmer la Recharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

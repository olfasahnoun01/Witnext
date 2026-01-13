import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package,
  AlertCircle,
  Trash2,
  Edit,
  CalendarIcon,
  X
} from 'lucide-react';
import { getAllProducts, getAllTransactions, createTransaction } from '@/services/dbService';
import { Product, Transaction } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CategoryProductSelector } from './shared/CategoryProductSelector';

type TabType = 'in' | 'out';

export const Transactions = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('in');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editNote, setEditNote] = useState('');
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) return;
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);
    
    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    
    toast.success('Transaction supprimée');
    await loadData();
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditQuantity(tx.quantity);
    setEditNote(tx.note || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;
    
    const { error } = await supabase
      .from('transactions')
      .update({ quantity: editQuantity, note: editNote })
      .eq('id', editingTransaction.id);
    
    if (error) {
      toast.error('Erreur lors de la modification');
      return;
    }
    
    toast.success('Transaction modifiée');
    setEditingTransaction(null);
    await loadData();
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [productsData, transactionsData] = await Promise.all([
      getAllProducts(),
      getAllTransactions()
    ]);
    setProducts(productsData);
    setTransactions(transactionsData);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId || !selectedProduct) {
      setError('Veuillez sélectionner un produit');
      return;
    }

    if (quantity <= 0) {
      setError('La quantité doit être supérieure à 0');
      return;
    }

    if (activeTab === 'out' && quantity > selectedProduct.quantity) {
      setError(`Stock insuffisant. Disponible: ${selectedProduct.quantity} unités`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createTransaction({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        type: activeTab === 'in' ? 'IN' : 'OUT',
        quantity,
        date: transactionDate.toISOString(),
        note
      });

      if (!result.success) {
        setError(result.error || 'Erreur lors de la création de la transaction');
        return;
      }

      // Reset form
      setSelectedProductId('');
      setQuantity(1);
      setNote('');
      setTransactionDate(new Date());
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const recentTransactions = transactions
    .filter(t => activeTab === 'in' ? t.type === 'IN' : t.type === 'OUT')
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('in')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'in'
              ? 'bg-success text-success-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Entrée Stock
        </button>
        <button
          onClick={() => setActiveTab('out')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'out'
              ? 'bg-destructive text-destructive-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Sortie Stock
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {activeTab === 'in' ? 'Nouvelle Entrée' : 'Nouvelle Sortie'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="form-label">Produit *</label>
              {selectedProduct ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
                  <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedProduct.image ? (
                      <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.sku}
                      {selectedProduct.size && ` • ${selectedProduct.size}`}
                      {selectedProduct.color && ` • ${selectedProduct.color}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Stock: <span className="font-semibold">{selectedProduct.quantity}</span> unités
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProductId('');
                      setError('');
                    }}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <CategoryProductSelector
                  selectedProductId={selectedProductId}
                  onSelect={(product) => {
                    setSelectedProductId(product.id);
                    setError('');
                  }}
                />
              )}

            </div>

            <div>
              <label className="form-label">Quantité *</label>
              <input
                type="number"
                required
                min="1"
                max={activeTab === 'out' && selectedProduct ? selectedProduct.quantity : undefined}
                value={quantity}
                onChange={(e) => {
                  setQuantity(parseInt(e.target.value) || 0);
                  setError('');
                }}
                className="form-input"
              />
              {activeTab === 'out' && selectedProduct && (
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum disponible: {selectedProduct.quantity} unités
                </p>
              )}
            </div>

            <div>
              <label className="form-label">Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !transactionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {transactionDate ? format(transactionDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={transactionDate}
                    onSelect={(date) => date && setTransactionDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="form-label">Note (optionnel)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="form-input resize-none"
                rows={3}
                placeholder="Ex: Commande client ABC, Réception fournisseur..."
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full ${activeTab === 'in' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}`}
            >
              {isSubmitting ? (
                'Enregistrement...'
              ) : activeTab === 'in' ? (
                <>
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Enregistrer Entrée
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Enregistrer Sortie
                </>
              )}
            </Button>
          </form>
        </div>

        {/* History */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Historique - {activeTab === 'in' ? 'Entrées' : 'Sorties'}
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun mouvement enregistré
              </p>
            ) : (
              recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-muted/50"
                >
                  <div className={`p-2 rounded-lg ${
                    tx.type === 'IN' ? 'bg-success/10' : 'bg-destructive/10'
                  }`}>
                    {tx.type === 'IN' ? (
                      <ArrowDownLeft className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingTransaction?.id === tx.id ? (
                      <div className="space-y-2">
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                          className="form-input text-sm py-1"
                          min="1"
                        />
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="form-input text-sm py-1"
                          placeholder="Note..."
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>Enregistrer</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTransaction(null)}>Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{tx.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.quantity} unités • {new Date(tx.date).toLocaleDateString('fr-TN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {tx.note && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{tx.note}</p>
                        )}
                      </>
                    )}
                  </div>
                  {isAdmin && !editingTransaction && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditTransaction(tx)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

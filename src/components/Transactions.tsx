import { useState, useEffect, useCallback, memo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package,
  AlertCircle,
  CalendarIcon,
  X
} from 'lucide-react';
import { getAllProducts, createTransaction } from '@/services/dbService';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { ensureSupabaseSessionReady } from '@/lib/supabaseSession';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { debugLog } from '@/lib/debugLog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CategoryProductSelector } from './shared/CategoryProductSelector';
import { TransactionHistory } from './transactions/TransactionHistory';
import { writePendingWarehouseDocument } from '@/lib/appNavigationStorage';
import { requireActiveCompanyId } from '@/lib/activeCompany';
import { toast } from 'sonner';

type TabType = 'in' | 'out';

interface TransactionsProps {
  onTabChange?: (tab: string) => void;
}

export const Transactions = memo(({ onTabChange }: TransactionsProps) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('in');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [groupVariantIds, setGroupVariantIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const loadProducts = useCallback(async () => {
    const ready = await ensureSupabaseSessionReady();
    if (!ready) {
      notifySessionInvalid('Session expirée lors du chargement des produits');
      return;
    }
    const productsData = await getAllProducts();
    debugLog('Transactions.tsx:loadProducts', 'products loaded', {
      rowCount: productsData.length,
    }, 'F');
    setProducts(productsData);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useSessionResumeReload(loadProducts);
  useCompanyChangeReload(loadProducts);

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

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

      const docType = activeTab === 'in' ? 'BE' : 'BS';
      const targetTab = activeTab === 'in' ? 'be-magasin' : 'bs-magasin';
      const dateIso = transactionDate.toISOString().slice(0, 10);

      writePendingWarehouseDocument({
        companyId: requireActiveCompanyId(),
        type: docType,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku || '',
        quantity,
        unitPrice: selectedProduct.price || 0,
        date: dateIso,
        note: note || undefined,
        transactionId: result.transactionId,
      });

      setHistoryRefreshKey((k) => k + 1);

      toast.info(
        activeTab === 'in'
          ? "Transaction enregistrée. Créez le bon d'entrée pour finaliser."
          : 'Transaction enregistrée. Créez le bon de sortie pour finaliser.'
      );

      onTabChange?.(targetTab);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransactionChange = () => {
    loadProducts();
  };

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
                      setGroupVariantIds([]);
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
                  onGroupSelect={(group, variants) => {
                    // When a group is selected, store all variant IDs for history
                    setGroupVariantIds(variants.map(v => v.id));
                  }}
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
        <TransactionHistory
          key={`${activeTab}-${historyRefreshKey}`}
          activeTab={activeTab}
          selectedProduct={selectedProduct}
          groupVariantIds={groupVariantIds}
          isAdmin={isAdmin}
          onTransactionChange={handleTransactionChange}
        />
      </div>
    </div>
  );
});

Transactions.displayName = 'Transactions';

import { useState, useCallback, memo } from 'react';
import { formatAppDate } from '@/lib/formatAppDate';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertCircle,
  CalendarIcon,
  X
} from 'lucide-react';
import { createTransaction, getProductById } from '@/modules/inventory';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { ensureSupabaseSessionReady } from '@/lib/supabaseSession';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CategoryProductSelector } from './shared/CategoryProductSelector';
import { TransactionHistory } from './transactions/TransactionHistory';
import { writePendingWarehouseDocument } from '@/lib/appNavigationStorage';
import { requireActiveCompanyId } from '@/lib/activeCompany';
import { LazyProductImage } from '@/components/shared/LazyProductImage';
import { toast } from 'sonner';

type TabType = 'in' | 'out';

import { useSubsectionNavigate } from '@/hooks/useSubsectionNavigate';

interface TransactionsProps {
  onTabChange?: (tab: string) => void;
}

export const Transactions = memo(({ onTabChange }: TransactionsProps) => {
  const { navigateToSubsection } = useSubsectionNavigate();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('in');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [groupVariantIds, setGroupVariantIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const refreshSelectedProduct = useCallback(async () => {
    if (!selectedProduct) return;
    const fresh = await getProductById(selectedProduct.id);
    if (fresh) setSelectedProduct(fresh);
  }, [selectedProduct]);

  useSessionResumeReload(refreshSelectedProduct);
  useCompanyChangeReload(() => {
    setSelectedProduct(null);
    setGroupVariantIds([]);
    setError('');
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let product = selectedProduct;
    if (!product) {
      setError('Veuillez sélectionner un produit');
      toast.error('Veuillez sélectionner un produit');
      return;
    }

    if (quantity <= 0) {
      setError('La quantité doit être supérieure à 0');
      toast.error('La quantité doit être supérieure à 0');
      return;
    }

    // Refresh stock from DB before OUT validation (selector data may be stale).
    const fresh = await getProductById(product.id);
    if (fresh) {
      product = fresh;
      setSelectedProduct(fresh);
    }

    if (activeTab === 'out' && quantity > product.quantity) {
      const msg = `Stock insuffisant. Disponible: ${product.quantity} unités`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) {
        notifySessionInvalid('Session expirée — reconnectez-vous pour enregistrer la transaction');
        return;
      }

      const result = await createTransaction({
        product_id: product.id,
        product_name: product.name,
        type: activeTab === 'in' ? 'IN' : 'OUT',
        quantity,
        date: transactionDate.toISOString(),
        note,
      });

      if (!result.success) {
        const msg = result.error || 'Erreur lors de la création de la transaction';
        setError(msg);
        toast.error(msg);
        return;
      }

      const docType = activeTab === 'in' ? 'BE' : 'BS';
      const targetTab = activeTab === 'in' ? 'be-magasin' : 'bs-magasin';
      const dateIso = transactionDate.toISOString().slice(0, 10);

      try {
        writePendingWarehouseDocument({
          companyId: requireActiveCompanyId(),
          type: docType,
          productId: product.id,
          productName: product.name,
          sku: product.sku || '',
          quantity,
          unitPrice: product.price || 0,
          date: dateIso,
          note: note || undefined,
          transactionId: result.transactionId,
        });
      } catch (pendingErr) {
        console.warn('Pending warehouse document not saved:', pendingErr);
        toast.warning(
          "Transaction enregistrée, mais le bon n'a pas pu être pré-rempli. Créez-le manuellement."
        );
        setHistoryRefreshKey((k) => k + 1);
        await refreshSelectedProduct();
        return;
      }

      setHistoryRefreshKey((k) => k + 1);
      await refreshSelectedProduct();

      toast.success(
        activeTab === 'in'
          ? "Entrée enregistrée. Complétez le bon d'entrée."
          : 'Sortie enregistrée. Complétez le bon de sortie.'
      );

      (onTabChange ?? navigateToSubsection)(targetTab);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Erreur lors de la création de la transaction';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransactionChange = () => {
    void refreshSelectedProduct();
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
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <label className="form-label">Produit *</label>
              {selectedProduct ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
                  <LazyProductImage
                    productId={selectedProduct.id}
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded-lg flex-shrink-0"
                  />
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
                      setSelectedProduct(null);
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
                  selectedProductId={selectedProduct?.id ?? ''}
                  onGroupSelect={(group, variants) => {
                    setGroupVariantIds(variants.map((v) => v.id));
                  }}
                  onSelect={(product) => {
                    setSelectedProduct(product);
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
                    {transactionDate ? formatAppDate(transactionDate) : <span>Choisir une date</span>}
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

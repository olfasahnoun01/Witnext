import { useState, useCallback, useMemo, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Edit, Trash2, Search, ChevronLeft, ChevronRight, List, Package } from 'lucide-react';
import { Transaction, Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface TransactionHistoryProps {
  activeTab: 'in' | 'out';
  selectedProduct: Product | null;
  groupVariantIds: number[];
  isAdmin: boolean;
  onTransactionChange: () => void;
}

const ITEMS_PER_PAGE = 5;

export const TransactionHistory = ({
  activeTab,
  selectedProduct,
  groupVariantIds,
  isAdmin,
  onTransactionChange
}: TransactionHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [historyMode, setHistoryMode] = useState<'general' | 'particular'>('particular');
  
  // Editing state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editNote, setEditNote] = useState('');

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('type', activeTab === 'in' ? 'IN' : 'OUT')
        .order('date', { ascending: false });

      // If in particular mode, filter by selected product/group
      if (historyMode === 'particular') {
        const productIdsToFetch = selectedProduct 
          ? [selectedProduct.id] 
          : groupVariantIds.length > 0 
            ? groupVariantIds 
            : [];

        if (productIdsToFetch.length === 0) {
          setTransactions([]);
          setIsLoading(false);
          return;
        }

        query = query.in('product_id', productIdsToFetch);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setTransactions(data as Transaction[] || []);
      setCurrentPage(1);
      setPageInputValue('1');
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, groupVariantIds, activeTab, historyMode]);

  // Auto-load when dependencies change
  useEffect(() => {
    if (historyMode === 'general') {
      loadTransactions();
    } else if (selectedProduct || groupVariantIds.length > 0) {
      loadTransactions();
    } else {
      setTransactions([]);
    }
  }, [selectedProduct?.id, groupVariantIds, activeTab, historyMode, loadTransactions]);

  // Pagination
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return transactions.slice(start, start + ITEMS_PER_PAGE);
  }, [transactions, currentPage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(pageInputValue);
      if (pageNum >= 1 && pageNum <= totalPages) {
        setCurrentPage(pageNum);
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInputValue(currentPage.toString());
    }
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
    loadTransactions();
    onTransactionChange();
  };

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
    loadTransactions();
    onTransactionChange();
  };

  const showEmptyProductMessage = historyMode === 'particular' && !selectedProduct && groupVariantIds.length === 0;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-3">
        Historique - {activeTab === 'in' ? 'Entrées' : 'Sorties'}
      </h3>

      {/* Toggle buttons for history mode */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={historyMode === 'general' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setHistoryMode('general')}
          className="flex-1"
        >
          <List className="w-4 h-4 mr-2" />
          Historique Général
        </Button>
        <Button
          variant={historyMode === 'particular' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setHistoryMode('particular')}
          className="flex-1"
        >
          <Package className="w-4 h-4 mr-2" />
          Historique Particulier
        </Button>
      </div>

      {showEmptyProductMessage ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sélectionnez un produit pour voir son historique
        </p>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {paginatedTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {historyMode === 'general' 
                  ? 'Aucun mouvement enregistré'
                  : 'Aucun mouvement enregistré pour ce produit'
                }
              </p>
            ) : (
              paginatedTransactions.map((tx) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setCurrentPage(newPage);
                  setPageInputValue(newPage.toString());
                }}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageInputKeyDown}
                  onBlur={handlePageInputBlur}
                  className="w-14 h-8 text-center"
                />
                <span className="text-muted-foreground">sur {totalPages}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(newPage);
                  setPageInputValue(newPage.toString());
                }}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Reload button */}
          <div className="mt-3 text-center">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={loadTransactions}
              disabled={isLoading}
            >
              <Search className="w-3 h-3 mr-1" />
              Actualiser
            </Button>
          </div>
        </>
      )}
    </div>
  );
};


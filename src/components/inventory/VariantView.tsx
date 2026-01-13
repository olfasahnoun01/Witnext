import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, RefreshCw, Edit, Trash2, Package } from 'lucide-react';
import { ProductGroup, Product, StockStatus } from '@/types';
import { getVariantsByGroupId, createVariant } from '@/services/productGroupService';
import { updateProduct, deleteProduct } from '@/services/dbService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface VariantViewProps {
  group: ProductGroup;
  onBack: () => void;
}

const getStockStatus = (product: Product): StockStatus => {
  if (product.quantity === 0) return 'out_of_stock';
  if (product.quantity <= product.min_stock) return 'low_stock';
  return 'in_stock';
};

const statusStyles: Record<StockStatus, { bg: string; text: string; label: string }> = {
  in_stock: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'En stock' },
  low_stock: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Stock faible' },
  out_of_stock: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rupture' }
};

interface VariantFormData {
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

const emptyFormData: VariantFormData = {
  sku: '',
  size: '',
  color: '',
  quantity: 0,
  price: 0
};

export const VariantView = ({ group, onBack }: VariantViewProps) => {
  const [variants, setVariants] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [formData, setFormData] = useState<VariantFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVariants = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVariantsByGroupId(group.id);
      setVariants(data);
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // Subscribe to realtime changes on products table
  useRealtimeData({
    tables: ['products'],
    onDataChange: fetchVariants,
    showToast: true
  });

  const totalStock = variants.reduce((sum, v) => sum + v.quantity, 0);

  const handleOpenModal = useCallback((variant?: Product) => {
    if (variant) {
      setEditingVariant(variant);
      setFormData({
        sku: variant.sku,
        size: variant.size || '',
        color: variant.color || '',
        quantity: variant.quantity,
        price: variant.price
      });
    } else {
      setEditingVariant(null);
      setFormData({
        ...emptyFormData,
        sku: `${group.base_sku || 'NEW'}-${variants.length + 1}`
      });
    }
    setIsModalOpen(true);
  }, [group.base_sku, variants.length]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingVariant(null);
    setFormData(emptyFormData);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.sku.trim()) {
      toast.error('Le code article est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVariant) {
        await updateProduct(editingVariant.id, {
          sku: formData.sku,
          size: formData.size || undefined,
          color: formData.color || undefined,
          quantity: formData.quantity,
          price: formData.price
        });
        toast.success('Variante mise à jour');
      } else {
        const result = await createVariant(group.id, {
          sku: formData.sku,
          size: formData.size,
          color: formData.color,
          quantity: formData.quantity,
          price: formData.price
        });
        
        if (!result.success) {
          toast.error(result.error || 'Erreur lors de la création');
          return;
        }
        toast.success('Variante créée');
      }
      
      handleCloseModal();
      fetchVariants();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingVariant, formData, group.id, handleCloseModal, fetchVariants]);

  const handleDelete = useCallback(async (variant: Product) => {
    if (!window.confirm(`Supprimer la variante "${variant.sku}" ?`)) return;
    
    try {
      await deleteProduct(variant.id);
      toast.success('Variante supprimée');
      fetchVariants();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  }, [fetchVariants]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div className="flex items-center gap-4">
            {group.image ? (
              <img 
                src={group.image} 
                alt={group.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">{group.name}</h2>
              <p className="text-sm text-muted-foreground">
                {variants.length} variante{variants.length !== 1 ? 's' : ''} • {totalStock} unités en stock
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVariants} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Variante
          </Button>
        </div>
      </div>

      {/* Product info summary */}
      <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Code Article Base</p>
          <p className="font-medium">{group.base_sku || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Catégorie</p>
          <p className="font-medium">{group.category}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fournisseur</p>
          <p className="font-medium">{group.fournisseur || 'Non défini'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Seuil d'alerte</p>
          <p className="font-medium">{group.min_stock} unités</p>
        </div>
      </div>

      {/* Variants table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : variants.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune variante pour ce produit.</p>
          <Button className="mt-4" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter la première variante
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code Article</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix Unit.</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => {
                const status = getStockStatus(variant);
                const style = statusStyles[status];
                
                return (
                  <TableRow key={variant.id}>
                    <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
                    <TableCell>{variant.size || '-'}</TableCell>
                    <TableCell>{variant.color || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{variant.quantity}</TableCell>
                    <TableCell className="text-right">{variant.price.toFixed(3)} TND</TableCell>
                    <TableCell>
                      <Badge className={`${style.bg} ${style.text} border-0`}>
                        {style.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(variant)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(variant)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Modifier la variante' : 'Ajouter une variante'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sku">Code Article *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="ex: 00001P.C.N"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="size">Taille</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="ex: 42, L, XL"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Couleur</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="ex: Noir, Bleu"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantité</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Prix (TND)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : (editingVariant ? 'Mettre à jour' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Phone, Calculator, Check, Pencil, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ProductGroup {
  id: number;
  name: string;
  category: string;
  fournisseurCount: number;
}

interface FournisseurPrice {
  id: number;
  fournisseur_name: string;
  prix_ttc: number;
  phone: string | null;
}

export const SupplierComparison = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [fournisseurPrices, setFournisseurPrices] = useState<FournisseurPrice[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState('');
  const [newFournisseurPrice, setNewFournisseurPrice] = useState('');
  const [existingFournisseurs, setExistingFournisseurs] = useState<string[]>([]);

  // Load categories and existing fournisseurs
  useEffect(() => {
    const loadInitialData = async () => {
      // Load categories
      const { data: catData } = await supabase
        .from('product_groups')
        .select('category')
        .order('category');
      
      if (catData) {
        const uniqueCategories = [...new Set(catData.map(p => p.category))];
        setCategories(uniqueCategories);
      }

      // Load all fournisseur names for autocomplete
      const { data: fournData } = await supabase
        .from('fournisseurs')
        .select('nom')
        .order('nom');
      
      if (fournData) {
        setExistingFournisseurs(fournData.map(f => f.nom));
      }
    };
    loadInitialData();
  }, []);

  // Load products when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setProducts([]);
      setSelectedProductId('');
      return;
    }

    const loadProducts = async () => {
      const { data } = await supabase
        .from('product_groups')
        .select('id, name, category')
        .eq('category', selectedCategory)
        .order('name');
      
      if (data) {
        // Get fournisseur counts for each product
        const productIds = data.map(p => p.id);
        const { data: fournisseurData } = await supabase
          .from('product_group_fournisseurs')
          .select('product_group_id')
          .in('product_group_id', productIds);

        const countMap = new Map<number, number>();
        fournisseurData?.forEach(f => {
          countMap.set(f.product_group_id, (countMap.get(f.product_group_id) || 0) + 1);
        });

        const productsWithCount: ProductGroup[] = data.map(p => ({
          ...p,
          fournisseurCount: countMap.get(p.id) || 0
        }));
        
        setProducts(productsWithCount);
      }
    };
    loadProducts();
    setSelectedProductId('');
    setFournisseurPrices([]);
  }, [selectedCategory]);

  // Load fournisseur prices when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setFournisseurPrices([]);
      return;
    }

    const loadFournisseurPrices = async () => {
      setLoading(true);
      
      // Get fournisseur prices for this product
      const { data: priceData } = await supabase
        .from('product_group_fournisseurs')
        .select('id, fournisseur_name, prix_ttc')
        .eq('product_group_id', parseInt(selectedProductId));

      if (priceData && priceData.length > 0) {
        // Get phone numbers from fournisseurs table
        const fournisseurNames = priceData.map(p => p.fournisseur_name);
        const { data: fournisseursData } = await supabase
          .from('fournisseurs')
          .select('nom, phone')
          .in('nom', fournisseurNames);

        const phoneMap = new Map(fournisseursData?.map(f => [f.nom, f.phone]) || []);

        const combined: FournisseurPrice[] = priceData.map(p => ({
          id: p.id,
          fournisseur_name: p.fournisseur_name,
          prix_ttc: p.prix_ttc,
          phone: phoneMap.get(p.fournisseur_name) || null
        }));

        // Sort by price
        combined.sort((a, b) => a.prix_ttc - b.prix_ttc);
        setFournisseurPrices(combined);
      } else {
        setFournisseurPrices([]);
      }
      
      setLoading(false);
    };
    loadFournisseurPrices();
  }, [selectedProductId]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id.toString() === selectedProductId);
  }, [products, selectedProductId]);

  const minPrice = useMemo(() => {
    if (fournisseurPrices.length === 0) return 0;
    return Math.min(...fournisseurPrices.map(f => f.prix_ttc));
  }, [fournisseurPrices]);

  const handleEditPrice = useCallback((fournisseur: FournisseurPrice) => {
    setEditingId(fournisseur.id);
    setEditingPrice(fournisseur.prix_ttc.toString());
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingPrice('');
  }, []);

  const handleSavePrice = useCallback(async (fournisseurId: number) => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Prix invalide');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('product_group_fournisseurs')
        .update({ prix_ttc: newPrice, updated_at: new Date().toISOString() })
        .eq('id', fournisseurId);

      if (error) throw error;

      // Update local state
      setFournisseurPrices(prev => 
        prev.map(f => f.id === fournisseurId ? { ...f, prix_ttc: newPrice } : f)
          .sort((a, b) => a.prix_ttc - b.prix_ttc)
      );

      toast.success('Prix mis à jour');
      setEditingId(null);
      setEditingPrice('');
    } catch (error: any) {
      console.error('Error updating price:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  }, [editingPrice]);

  const handleAddFournisseur = useCallback(async () => {
    if (!newFournisseurName.trim()) {
      toast.error('Nom du fournisseur requis');
      return;
    }
    const price = parseFloat(newFournisseurPrice) || 0;
    if (price < 0) {
      toast.error('Prix invalide');
      return;
    }

    const alreadyExists = fournisseurPrices.some(
      f => f.fournisseur_name.toLowerCase() === newFournisseurName.trim().toLowerCase()
    );
    if (alreadyExists) {
      toast.error('Ce fournisseur est déjà associé à ce produit');
      return;
    }

    setIsSaving(true);
    try {
      const fournisseurNameTrimmed = newFournisseurName.trim();
      
      // Check if fournisseur exists in the fournisseurs table
      const { data: existingFournisseur } = await supabase
        .from('fournisseurs')
        .select('id, phone')
        .eq('nom', fournisseurNameTrimmed)
        .maybeSingle();

      if (!existingFournisseur) {
        toast.error(
          'Ce fournisseur n\'existe pas dans l\'annuaire. Créez-le depuis la page Fournisseurs (téléphones, matricule fiscal, Patente et RNE) avant de l\'associer ici.'
        );
        setIsSaving(false);
        return;
      }

      // Add to product_group_fournisseurs
      const { data, error } = await supabase
        .from('product_group_fournisseurs')
        .insert({
          product_group_id: parseInt(selectedProductId),
          fournisseur_name: fournisseurNameTrimmed,
          prix_ttc: price,
        })
        .select('id, fournisseur_name, prix_ttc')
        .single();

      if (error) throw error;

      const newEntry: FournisseurPrice = {
        id: data.id,
        fournisseur_name: data.fournisseur_name,
        prix_ttc: data.prix_ttc,
        phone: existingFournisseur.phone || null,
      };

      setFournisseurPrices(prev => 
        [...prev, newEntry].sort((a, b) => a.prix_ttc - b.prix_ttc)
      );

      toast.success('Fournisseur ajouté au produit');
      setIsAddingNew(false);
      setNewFournisseurName('');
      setNewFournisseurPrice('');
    } catch (error: any) {
      console.error('Error adding fournisseur:', error);
      toast.error(error.message || "Erreur lors de l'ajout");
    } finally {
      setIsSaving(false);
    }
  }, [newFournisseurName, newFournisseurPrice, selectedProductId, fournisseurPrices]);

  const handleDeleteFournisseur = useCallback(async (fournisseurId: number, fournisseurName: string) => {
    if (!confirm(`Supprimer ${fournisseurName} de ce produit ?`)) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('product_group_fournisseurs')
        .delete()
        .eq('id', fournisseurId);

      if (error) throw error;

      setFournisseurPrices(prev => prev.filter(f => f.id !== fournisseurId));
      toast.success('Fournisseur supprimé');
    } catch (error: any) {
      console.error('Error deleting fournisseur:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Comparaison des Prix Fournisseurs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label>Produit</Label>
              <Select 
                value={selectedProductId} 
                onValueChange={setSelectedProductId}
                disabled={!selectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
                <SelectContent className="min-w-[300px]">
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id.toString()} className="relative pr-14">
                      <span className="truncate">{product.name}</span>
                      <Badge 
                        variant={product.fournisseurCount > 0 ? "default" : "secondary"} 
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        {product.fournisseurCount}Fr
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label>Quantité</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={!selectedProductId}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectedProductId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedProduct?.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{fournisseurPrices.length} fournisseur(s)</Badge>
                <Button
                  size="sm"
                  onClick={() => setIsAddingNew(true)}
                  disabled={isAddingNew}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add New Fournisseur Form */}
            {isAddingNew && (
              <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nom du fournisseur</Label>
                    <Input
                      list="fournisseur-list"
                      value={newFournisseurName}
                      onChange={(e) => setNewFournisseurName(e.target.value)}
                      placeholder="Sélectionner ou saisir un nom"
                      autoFocus
                    />
                    <datalist id="fournisseur-list">
                      {existingFournisseurs.map(f => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Prix TTC</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={newFournisseurPrice}
                      onChange={(e) => setNewFournisseurPrice(e.target.value)}
                      placeholder="0.000"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddFournisseur();
                        if (e.key === 'Escape') {
                          setIsAddingNew(false);
                          setNewFournisseurName('');
                          setNewFournisseurPrice('');
                        }
                      }}
                    />
                  </div>
                  <Button
                    size="icon"
                    onClick={handleAddFournisseur}
                    disabled={isSaving || !newFournisseurName.trim()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewFournisseurName('');
                      setNewFournisseurPrice('');
                    }}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Chargement...
              </div>
            ) : fournisseurPrices.length === 0 && !isAddingNew ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun fournisseur associé à ce produit</p>
                <p className="text-sm mt-2">Cliquez sur "Ajouter" pour associer un fournisseur</p>
              </div>
            ) : fournisseurPrices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Prix TTC Unitaire</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fournisseurPrices.map((fournisseur) => {
                    const total = fournisseur.prix_ttc * quantity;
                    const isLowest = fournisseur.prix_ttc === minPrice;
                    const isEditing = editingId === fournisseur.id;
                    
                    return (
                      <TableRow key={fournisseur.id} className={isLowest ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          {fournisseur.fournisseur_name}
                          {isLowest && (
                            <Badge className="ml-2 bg-primary text-primary-foreground">
                              Meilleur prix
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {fournisseur.phone ? (
                            <a 
                              href={`tel:${fournisseur.phone}`}
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Phone className="h-4 w-4" />
                              {fournisseur.phone}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              className="w-28 text-right ml-auto"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePrice(fournisseur.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                          ) : (
                            <span>{fournisseur.prix_ttc.toFixed(3)} TND</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {quantity}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {isEditing 
                            ? ((parseFloat(editingPrice) || 0) * quantity).toFixed(3)
                            : total.toFixed(3)
                          } TND
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                onClick={() => handleSavePrice(fournisseur.id)}
                                disabled={isSaving}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleEditPrice(fournisseur)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteFournisseur(fournisseur.id, fournisseur.fournisseur_name)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedProductId && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Comparez les prix des fournisseurs
            </h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez une catégorie puis un produit pour voir les prix de chaque fournisseur
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

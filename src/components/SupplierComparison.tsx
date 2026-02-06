import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Package, TrendingDown, TrendingUp, Calculator, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProductGroup, ProductGroupFournisseur } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProductWithFournisseurs extends ProductGroup {
  fournisseurs: ProductGroupFournisseur[];
}

export const SupplierComparison = () => {
  const [products, setProducts] = useState<ProductWithFournisseurs[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithFournisseurs | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Load all product groups with their suppliers
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get all product groups
        const { data: groups, error: groupsError } = await supabase
          .from('product_groups')
          .select('*')
          .order('name');
        
        if (groupsError) throw groupsError;
        
        // Get all product group fournisseurs
        const { data: fournisseurs, error: fournisseursError } = await supabase
          .from('product_group_fournisseurs')
          .select('*');
        
        if (fournisseursError) throw fournisseursError;
        
        // Group fournisseurs by product_group_id
        const fournisseursByGroup: Record<number, ProductGroupFournisseur[]> = {};
        fournisseurs?.forEach(f => {
          if (!fournisseursByGroup[f.product_group_id]) {
            fournisseursByGroup[f.product_group_id] = [];
          }
          fournisseursByGroup[f.product_group_id].push({
            id: f.id,
            product_group_id: f.product_group_id,
            fournisseur_name: f.fournisseur_name,
            prix_ttc: Number(f.prix_ttc)
          });
        });
        
        // Combine products with their fournisseurs
        const productsWithFournisseurs: ProductWithFournisseurs[] = (groups || []).map(g => ({
          id: g.id,
          name: g.name,
          category: g.category,
          base_sku: g.base_sku,
          fournisseur: g.fournisseur,
          image: g.image,
          min_stock: g.min_stock,
          created_at: g.created_at,
          updated_at: g.updated_at,
          fournisseurs: fournisseursByGroup[g.id] || []
        }));
        
        // Only keep products with multiple suppliers
        const productsWithMultipleSuppliers = productsWithFournisseurs.filter(
          p => p.fournisseurs.length > 1
        );
        
        setProducts(productsWithMultipleSuppliers);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(productsWithMultipleSuppliers.map(p => p.category))];
        setCategories(uniqueCategories.filter(Boolean).sort());
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.base_sku?.toLowerCase().includes(term) ||
        p.fournisseurs.some(f => f.fournisseur_name.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Calculate comparison data for selected product
  const comparisonData = useMemo(() => {
    if (!selectedProduct || selectedProduct.fournisseurs.length === 0) return null;
    
    const suppliers = selectedProduct.fournisseurs.map(f => ({
      ...f,
      totalPrice: f.prix_ttc * quantity
    }));
    
    suppliers.sort((a, b) => a.prix_ttc - b.prix_ttc);
    
    const minPrice = suppliers[0]?.prix_ttc || 0;
    const maxPrice = suppliers[suppliers.length - 1]?.prix_ttc || 0;
    const priceDiff = maxPrice - minPrice;
    const totalDiff = priceDiff * quantity;
    const savingsPercent = maxPrice > 0 ? ((priceDiff / maxPrice) * 100).toFixed(1) : '0';
    
    return {
      suppliers,
      minPrice,
      maxPrice,
      priceDiff,
      totalDiff,
      savingsPercent
    };
  }, [selectedProduct, quantity]);

  const handleProductSelect = useCallback((productId: string) => {
    const product = products.find(p => p.id === Number(productId));
    setSelectedProduct(product || null);
    setQuantity(1);
  }, [products]);

  // Stats
  const totalProductsWithMultipleSuppliers = products.length;
  const avgSuppliersPerProduct = products.length > 0
    ? (products.reduce((sum, p) => sum + p.fournisseurs.length, 0) / products.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits Multi-Fournisseurs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProductsWithMultipleSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              produits avec plusieurs fournisseurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne Fournisseurs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuppliersPerProduct}</div>
            <p className="text-xs text-muted-foreground">
              fournisseurs par produit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Économie Potentielle</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {comparisonData ? `${comparisonData.totalDiff.toFixed(2)} TND` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {comparisonData ? `${comparisonData.savingsPercent}% d'économie possible` : 'Sélectionnez un produit'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sélectionner un Produit à Comparer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product select */}
            <Select 
              value={selectedProduct?.id.toString() || ''} 
              onValueChange={handleProductSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un produit..." />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map(product => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name} ({product.fournisseurs.length} fournisseurs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quantity */}
            <div className="space-y-1">
              <Label htmlFor="quantity" className="text-xs text-muted-foreground">Quantité</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Quantité"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      ) : !selectedProduct ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Sélectionnez un produit pour comparer
            </h3>
            <p className="text-sm text-muted-foreground">
              {products.length === 0 
                ? "Aucun produit avec plusieurs fournisseurs n'a été trouvé. Ajoutez des fournisseurs aux produits dans l'inventaire."
                : "Choisissez un produit dans la liste ci-dessus pour voir la comparaison des prix entre fournisseurs."}
            </p>
          </CardContent>
        </Card>
      ) : comparisonData && comparisonData.suppliers.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                {selectedProduct.image ? (
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-xl">{selectedProduct.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{selectedProduct.category}</Badge>
                    {selectedProduct.base_sku && (
                      <Badge variant="secondary">{selectedProduct.base_sku}</Badge>
                    )}
                    <Badge variant="default">{comparisonData.suppliers.length} fournisseurs</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Quantité</p>
                  <p className="text-2xl font-bold">{quantity}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Économie possible</p>
                  <p className="text-2xl font-bold text-primary">{comparisonData.totalDiff.toFixed(2)} TND</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Prix Unitaire TTC</TableHead>
                  <TableHead className="text-right">Prix Total ({quantity} unités)</TableHead>
                  <TableHead className="text-right">Différence</TableHead>
                  <TableHead className="text-center">Évaluation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.suppliers.map((supplier, index) => {
                  const isLowest = index === 0;
                  const isHighest = index === comparisonData.suppliers.length - 1;
                  const diffFromLowest = (supplier.prix_ttc - comparisonData.minPrice) * quantity;
                  
                  return (
                    <TableRow key={supplier.id} className={isLowest ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        {supplier.fournisseur_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.prix_ttc.toFixed(2)} TND
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {supplier.totalPrice.toFixed(2)} TND
                      </TableCell>
                      <TableCell className="text-right">
                        {diffFromLowest > 0 ? (
                          <span className="text-destructive">+{diffFromLowest.toFixed(2)} TND</span>
                        ) : (
                          <span className="text-primary">Meilleur prix</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isLowest && (
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            Recommandé
                          </Badge>
                        )}
                        {isHighest && comparisonData.suppliers.length > 1 && !isLowest && (
                          <Badge variant="destructive">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Plus cher
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucun fournisseur configuré
            </h3>
            <p className="text-sm text-muted-foreground">
              Ce produit n'a pas de fournisseurs avec des prix configurés.
              Modifiez le produit pour ajouter des fournisseurs et leurs prix TTC.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

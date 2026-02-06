import { useState, useEffect, useMemo } from 'react';
import { Package, Phone, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
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

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('product_groups')
        .select('category')
        .order('category');
      
      if (data) {
        const uniqueCategories = [...new Set(data.map(p => p.category))];
        setCategories(uniqueCategories);
      }
    };
    loadCategories();
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
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{product.name}</span>
                        <Badge variant={product.fournisseurCount > 0 ? "default" : "secondary"} className="ml-auto">
                          {product.fournisseurCount} fournisseur{product.fournisseurCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
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
              <Badge variant="outline">{fournisseurPrices.length} fournisseur(s)</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Chargement...
              </div>
            ) : fournisseurPrices.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun fournisseur associé à ce produit</p>
                <p className="text-sm mt-2">Ajoutez des fournisseurs dans la fiche produit</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Prix TTC Unitaire</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fournisseurPrices.map((fournisseur) => {
                    const total = fournisseur.prix_ttc * quantity;
                    const isLowest = fournisseur.prix_ttc === minPrice;
                    
                    return (
                      <TableRow key={fournisseur.id} className={isLowest ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          {fournisseur.fournisseur_name}
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
                          {fournisseur.prix_ttc.toFixed(3)} TND
                        </TableCell>
                        <TableCell className="text-right">
                          {quantity}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {total.toFixed(3)} TND
                        </TableCell>
                        <TableCell className="text-center">
                          {isLowest && (
                            <Badge className="bg-primary text-primary-foreground">
                              Meilleur prix
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
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

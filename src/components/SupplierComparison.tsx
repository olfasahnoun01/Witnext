import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, TrendingDown, TrendingUp, Package } from 'lucide-react';
import { getAllProducts } from '@/services/dbService';
import { Product } from '@/types';
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

interface ArticleGroup {
  name: string;
  category: string;
  size: string;
  suppliers: {
    fournisseur: string;
    price: number;
    remise: number;
    prixTTC: number | null;
    quantity: number;
    sku: string;
    id: number;
  }[];
  minPrice: number;
  maxPrice: number;
  minPrixTTC: number;
  maxPrixTTC: number;
  priceDiff: number;
  prixTTCDiff: number;
}

export const SupplierComparison = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'priceDiff' | 'suppliers'>('name');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const allProducts = await getAllProducts();
    setProducts(allProducts);
  };

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(products.map(p => p.category))];
    return uniqueCategories.filter(Boolean).sort();
  }, [products]);

  // Group products by name + category + size (same article from different suppliers)
  const articleGroups = useMemo(() => {
    const groups: Record<string, ArticleGroup> = {};

    products.forEach(product => {
      // Key based on article name, category and size
      const key = `${product.name.toLowerCase().trim()}_${product.category}_${product.size}`;
      
      if (!groups[key]) {
        groups[key] = {
          name: product.name,
          category: product.category,
          size: product.size,
          suppliers: [],
          minPrice: Infinity,
          maxPrice: -Infinity,
          minPrixTTC: Infinity,
          maxPrixTTC: -Infinity,
          priceDiff: 0,
          prixTTCDiff: 0
        };
      }

      const prixTTC = product.prix_ttc ?? null;

      groups[key].suppliers.push({
        fournisseur: product.fournisseur,
        price: product.price,
        remise: product.remise ?? 0,
        prixTTC: prixTTC,
        quantity: product.quantity,
        sku: product.sku,
        id: product.id
      });

      if (product.price < groups[key].minPrice) {
        groups[key].minPrice = product.price;
      }
      if (product.price > groups[key].maxPrice) {
        groups[key].maxPrice = product.price;
      }
      if (prixTTC !== null && prixTTC < groups[key].minPrixTTC) {
        groups[key].minPrixTTC = prixTTC;
      }
      if (prixTTC !== null && prixTTC > groups[key].maxPrixTTC) {
        groups[key].maxPrixTTC = prixTTC;
      }
    });

    // Calculate price difference and filter only articles with multiple suppliers
    return Object.values(groups)
      .map(group => ({
        ...group,
        priceDiff: group.maxPrice - group.minPrice,
        prixTTCDiff: group.maxPrixTTC !== -Infinity && group.minPrixTTC !== Infinity 
          ? group.maxPrixTTC - group.minPrixTTC 
          : 0
      }))
      .filter(group => group.suppliers.length > 1);
  }, [products]);

  // Filter and sort
  const filteredGroups = useMemo(() => {
    let filtered = articleGroups;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(term) ||
        group.suppliers.some(s => s.fournisseur.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(group => group.category === categoryFilter);
    }

    // Sort
    switch (sortBy) {
      case 'priceDiff':
        filtered = [...filtered].sort((a, b) => b.priceDiff - a.priceDiff);
        break;
      case 'suppliers':
        filtered = [...filtered].sort((a, b) => b.suppliers.length - a.suppliers.length);
        break;
      case 'name':
      default:
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [articleGroups, searchTerm, categoryFilter, sortBy]);

  const totalArticles = articleGroups.length;
  const avgPriceDiff = articleGroups.length > 0
    ? articleGroups.reduce((sum, g) => sum + g.priceDiff, 0) / articleGroups.length
    : 0;
  const maxPriceDiff = articleGroups.length > 0
    ? Math.max(...articleGroups.map(g => g.priceDiff))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles Multi-Fournisseurs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              articles disponibles chez plusieurs fournisseurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Écart Moyen</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgPriceDiff.toFixed(2)} TND</div>
            <p className="text-xs text-muted-foreground">
              différence moyenne entre fournisseurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Écart Maximum</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{maxPriceDiff.toFixed(2)} TND</div>
            <p className="text-xs text-muted-foreground">
              plus grande différence de prix
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par article ou fournisseur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nom</SelectItem>
                <SelectItem value="priceDiff">Écart de prix</SelectItem>
                <SelectItem value="suppliers">Nombre de fournisseurs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucun article multi-fournisseurs trouvé
            </h3>
            <p className="text-sm text-muted-foreground">
              {products.length === 0 
                ? "Commencez par ajouter des produits à votre inventaire."
                : "Pour comparer les prix, ajoutez le même article avec différents fournisseurs dans l'inventaire."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{group.category}</Badge>
                      <Badge variant="secondary">Taille: {group.size}</Badge>
                      <Badge variant="default">{group.suppliers.length} fournisseurs</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Écart de prix</p>
                      <p className={`text-lg font-bold ${group.priceDiff > 10 ? 'text-destructive' : 'text-primary'}`}>
                        {group.priceDiff.toFixed(2)} TND
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Code Article</TableHead>
                      <TableHead className="text-right">Prix HT</TableHead>
                      <TableHead className="text-right">Remise</TableHead>
                      <TableHead className="text-right">Prix TTC</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-center">Comparaison</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.suppliers
                      .sort((a, b) => (a.prixTTC ?? a.price) - (b.prixTTC ?? b.price))
                      .map((supplier) => {
                        const effectivePrice = supplier.prixTTC ?? supplier.price;
                        const isLowest = supplier.prixTTC !== null 
                          ? supplier.prixTTC === group.minPrixTTC 
                          : supplier.price === group.minPrice;
                        const isHighest = supplier.prixTTC !== null 
                          ? supplier.prixTTC === group.maxPrixTTC 
                          : supplier.price === group.maxPrice;
                        return (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium">{supplier.fournisseur}</TableCell>
                            <TableCell className="text-muted-foreground">{supplier.sku}</TableCell>
                            <TableCell className="text-right">
                              {supplier.price.toFixed(2)} TND
                            </TableCell>
                            <TableCell className="text-right">
                              {supplier.remise > 0 ? (
                                <Badge variant="secondary" className="text-primary">
                                  -{supplier.remise}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {supplier.prixTTC !== null ? (
                                `${supplier.prixTTC.toFixed(2)} TND`
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={supplier.quantity > 0 ? 'default' : 'destructive'}>
                                {supplier.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {isLowest && (
                                <Badge variant="default" className="bg-primary text-primary-foreground">
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                  Moins cher
                                </Badge>
                              )}
                              {isHighest && group.suppliers.length > 1 && !isLowest && (
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
          ))}
        </div>
      )}
    </div>
  );
};

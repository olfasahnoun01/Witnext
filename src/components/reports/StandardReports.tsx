import { memo, useMemo, useState } from 'react';
import { FileText, Download, AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/types';
import { generateInventoryPDF, generateLowStockPDF } from '@/utils/pdfGenerator';

interface StandardReportsProps {
  products: Product[];
  lowStockProducts: Product[];
}

export const StandardReports = memo(({ products, lowStockProducts }: StandardReportsProps) => {
  const totalValue = products.reduce((s, p) => s + p.price * p.quantity, 0);
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('');

  const fournisseurs = useMemo(() => {
    const names = new Set<string>();
    products.forEach(p => { if (p.fournisseur) names.add(p.fournisseur.trim()); });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedFournisseur) return [];
    return products.filter(p => p.fournisseur === selectedFournisseur);
  }, [products, selectedFournisseur]);

  const filteredValue = filteredProducts.reduce((s, p) => s + p.price * p.quantity, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Inventory Report */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Liste Inventaire Complet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Génère un rapport PDF contenant tous les produits avec leurs quantités et valeurs.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {products.length} produits • Valeur: {totalValue.toFixed(3)} TND
            </p>
            <Button onClick={() => generateInventoryPDF(products)} className="mt-4">
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Inventory by Supplier */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-accent/10">
            <Filter className="w-8 h-8 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Inventaire par Fournisseur</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Liste d'inventaire filtrée par fournisseur sélectionné.
            </p>
            <Select value={selectedFournisseur} onValueChange={setSelectedFournisseur}>
              <SelectTrigger className="mt-3">
                <SelectValue placeholder="Choisir un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {fournisseurs.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFournisseur && (
              <p className="text-xs text-muted-foreground mt-2">
                {filteredProducts.length} produits • Valeur: {filteredValue.toFixed(3)} TND
              </p>
            )}
            <Button
              onClick={() => generateInventoryPDF(filteredProducts, selectedFournisseur)}
              className="mt-4"
              disabled={!selectedFournisseur || filteredProducts.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Low Stock Report */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Rapport Stock Faible</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Liste tous les produits en rupture ou avec un stock inférieur au minimum.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {lowStockProducts.length} produits nécessitent attention
            </p>
            <Button onClick={() => generateLowStockPDF(lowStockProducts)} variant="outline" className="mt-4">
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

StandardReports.displayName = 'StandardReports';

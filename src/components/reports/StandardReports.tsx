import { memo } from 'react';
import { FileText, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/types';
import { generateInventoryPDF, generateLowStockPDF } from '@/utils/pdfGenerator';

interface StandardReportsProps {
  products: Product[];
  lowStockProducts: Product[];
}

export const StandardReports = memo(({ products, lowStockProducts }: StandardReportsProps) => {
  const totalValue = products.reduce((s, p) => s + p.price * p.quantity, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

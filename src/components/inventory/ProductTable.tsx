import { memo } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Product, StockStatus } from '@/types';
import { priceTtcFromHt } from '@/lib/tva';
import { DEVIS_FODEC_RATE, round3 } from '@/lib/devisPricing';
import { EXCEL_TABLE_CLASS } from '@/lib/tableStyles';
import { LazyProductImage } from '@/components/shared/LazyProductImage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  isLoading?: boolean;
}

const getStockStatus = (product: Product): StockStatus => {
  if (product.quantity === 0) return 'out_of_stock';
  if (product.quantity <= product.min_stock) return 'low_stock';
  return 'in_stock';
};

const statusLabels: Record<StockStatus, { label: string; class: string }> = {
  in_stock: { label: 'En Stock', class: 'status-badge-success' },
  low_stock: { label: 'Stock Faible', class: 'status-badge-warning' },
  out_of_stock: { label: 'Rupture', class: 'status-badge-danger' }
};

function productFodecDisplay(product: Product): string {
  if (!product.subject_to_fodec) return '—';
  const netHt = product.price * (1 - (product.remise || 0) / 100);
  return `${round3(netHt * DEVIS_FODEC_RATE).toFixed(3)}`;
}

export const ProductTable = memo(({ products, onEdit, onDelete, isLoading }: ProductTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun produit trouvé
      </div>
    );
  }

  return (
    <div className={`table-container overflow-x-auto ${EXCEL_TABLE_CLASS}`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Image</TableHead>
            <TableHead>Désignation</TableHead>
            <TableHead>Code Article</TableHead>
            <TableHead>Taille</TableHead>
            <TableHead>Couleur</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead className="text-right">Prix HT</TableHead>
            <TableHead className="text-right">Net HT</TableHead>
            <TableHead className="text-right">FODEC 1%</TableHead>
            <TableHead className="text-right">Prix TTC</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const status = getStockStatus(product);
            const statusInfo = statusLabels[status];

            return (
              <TableRow key={product.id}>
                <TableCell>
                  <LazyProductImage
                    productId={product.id}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg"
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{product.sku}</TableCell>
                <TableCell>{product.size || '-'}</TableCell>
                <TableCell>{product.color || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{product.fournisseur || '-'}</TableCell>
                <TableCell className="text-right font-medium">{product.quantity}</TableCell>
                <TableCell className="text-right font-medium">{product.price.toFixed(3)}</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">{(product.price * (1 - (product.remise || 0) / 100)).toFixed(3)}</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">{productFodecDisplay(product)}</TableCell>
                <TableCell className="text-right font-medium">{priceTtcFromHt(product.price, product.remise || 0).toFixed(3)}</TableCell>
                <TableCell>
                  <span className={`status-badge ${statusInfo.class}`}>
                    {statusInfo.label}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(product)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(product)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

ProductTable.displayName = 'ProductTable';

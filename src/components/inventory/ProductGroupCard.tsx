import { memo } from 'react';
import { Package, Palette, Ruler } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductGroup, StockStatus } from '@/types';

interface ProductGroupCardProps {
  group: ProductGroup;
  onClick: () => void;
}

const getStockStatus = (group: ProductGroup): StockStatus => {
  if ((group.total_stock || 0) === 0) return 'out_of_stock';
  if ((group.total_stock || 0) <= group.min_stock) return 'low_stock';
  return 'in_stock';
};

const statusStyles: Record<StockStatus, { bg: string; text: string; label: string }> = {
  in_stock: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'En stock' },
  low_stock: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Stock faible' },
  out_of_stock: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rupture' }
};

export const ProductGroupCard = memo(({ group, onClick }: ProductGroupCardProps) => {
  const status = getStockStatus(group);
  const style = statusStyles[status];
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-border/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {group.image ? (
              <img 
                src={group.image} 
                alt={group.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground truncate" title={group.name}>
                {group.name}
              </h3>
              <Badge className={`${style.bg} ${style.text} border-0 text-xs whitespace-nowrap`}>
                {style.label}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {group.base_sku || 'N/A'}
            </p>
            
            {/* Variant info */}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                <Package className="w-3 h-3" />
                {group.variant_count || 0} variante{(group.variant_count || 0) !== 1 ? 's' : ''}
              </span>
              
              {group.colors && group.colors.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Palette className="w-3 h-3" />
                  {group.colors.length} couleur{group.colors.length !== 1 ? 's' : ''}
                </span>
              )}
              
              {group.sizes && group.sizes.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Ruler className="w-3 h-3" />
                  {group.sizes.length} taille{group.sizes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {/* Stock info */}
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-muted-foreground">Stock total:</span>
              <span className={`font-medium ${style.text}`}>
                {group.total_stock || 0} unités
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProductGroupCard.displayName = 'ProductGroupCard';

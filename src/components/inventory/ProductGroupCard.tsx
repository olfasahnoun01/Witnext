import { memo } from 'react';
import { Package, Palette, Ruler, Trash2, Pencil, AlertTriangle, FolderInput } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductGroup, StockStatus } from '@/types';

interface ProductGroupCardProps {
  group: ProductGroup;
  onClick: () => void;
  onEdit?: (group: ProductGroup) => void;
  onDelete?: (group: ProductGroup) => void;
  onMove?: (group: ProductGroup) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
}

const getStockStatus = (group: ProductGroup): StockStatus => {
  if ((group.total_stock || 0) === 0) return 'out_of_stock';
  if ((group.total_stock || 0) <= group.min_stock) return 'low_stock';
  return 'in_stock';
};

const hasNoSupplier = (group: ProductGroup): boolean => {
  // Check both old single supplier and new multi-suppliers
  const hasOldSupplier = group.fournisseur && group.fournisseur.trim() !== '';
  const hasNewSuppliers = group.fournisseurs && group.fournisseurs.length > 0;
  return !hasOldSupplier && !hasNewSuppliers;
};

const statusStyles: Record<StockStatus, { bg: string; text: string; label: string }> = {
  in_stock: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'En stock' },
  low_stock: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Stock faible' },
  out_of_stock: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rupture' }
};

export const ProductGroupCard = memo(({ group, onClick, onEdit, onDelete, onMove, canEdit, canDelete, canMove }: ProductGroupCardProps) => {
  const status = getStockStatus(group);
  const style = statusStyles[status];
  const noSupplier = hasNoSupplier(group);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(group);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(group);
  };

  const handleMoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove?.(group);
  };
  
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
            <div className="flex items-start gap-2">
              <h3 className="font-semibold text-foreground truncate flex-1 min-w-0" title={group.name}>
                {group.name}
              </h3>
              {(canEdit || canDelete || canMove) && (
                <div className="flex shrink-0 items-center gap-0.5">
                  {canMove && onMove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleMoveClick}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                      title="Déplacer vers une autre catégorie"
                    >
                      <FolderInput className="w-4 h-4" />
                    </Button>
                  )}
                  {canEdit && onEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleEditClick}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                      title="Modifier l'article"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {canDelete && onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteClick}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Supprimer l'article"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-sm text-muted-foreground truncate">
                {group.base_sku || 'N/A'}
              </p>
              <Badge className={`${style.bg} ${style.text} border-0 text-xs whitespace-nowrap shrink-0`}>
                {style.label}
              </Badge>
            </div>
            
            {/* Variant info */}
            <div className="flex flex-wrap gap-2 mt-2">
              {noSupplier && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                  <AlertTriangle className="w-3 h-3" />
                  Sans fournisseur
                </span>
              )}
              
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

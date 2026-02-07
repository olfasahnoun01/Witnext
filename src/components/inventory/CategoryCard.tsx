import { memo } from 'react';
import { 
  Package, 
  Shirt, 
  HardHat, 
  Footprints, 
  Hand, 
  Shield, 
  ShieldCheck,
  Snowflake,
  ChefHat,
  Layers,
  Pencil
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CategoryCardProps {
  name: string;
  count: number;
  onClick: () => void;
  onEdit?: (name: string) => void;
  canEdit?: boolean;
  customColor?: string;
}

const getCategoryIcon = (category: string) => {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('pantalon')) return Layers;
  if (lowerCategory.includes('blouson')) return Shirt;
  if (lowerCategory.includes('bordequin') || lowerCategory.includes('chaussure')) return Footprints;
  if (lowerCategory.includes('gant')) return Hand;
  if (lowerCategory.includes('casque')) return HardHat;
  if (lowerCategory.includes('gilet')) return ShieldCheck;
  if (lowerCategory.includes('polo') || lowerCategory.includes('t-shirt')) return Shirt;
  if (lowerCategory.includes('accessoire')) return Shield;
  if (lowerCategory.includes('parka') || lowerCategory.includes('manteau')) return Snowflake;
  if (lowerCategory.includes('tablier')) return ChefHat;
  return Package;
};

export const getCategoryColor = (category: string): string => {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('pantalon')) return 'from-blue-500 to-blue-600';
  if (lowerCategory.includes('blouson')) return 'from-indigo-500 to-indigo-600';
  if (lowerCategory.includes('bordequin')) return 'from-amber-500 to-amber-600';
  if (lowerCategory.includes('accessoire')) return 'from-purple-500 to-purple-600';
  if (lowerCategory.includes('gant')) return 'from-emerald-500 to-emerald-600';
  if (lowerCategory.includes('casque')) return 'from-red-500 to-red-600';
  if (lowerCategory.includes('gilet')) return 'from-orange-500 to-orange-600';
  if (lowerCategory.includes('polo') || lowerCategory.includes('t-shirt')) return 'from-teal-500 to-teal-600';
  if (lowerCategory.includes('parka') || lowerCategory.includes('manteau')) return 'from-sky-600 to-sky-700';
  if (lowerCategory.includes('tablier')) return 'from-rose-500 to-rose-600';
  if (lowerCategory.includes('non catégorisé')) return 'from-zinc-500 to-zinc-600';
  return 'from-stone-500 to-stone-600';
};

export const CategoryCard = memo(({ name, count, onClick, onEdit, canEdit, customColor }: CategoryCardProps) => {
  const Icon = getCategoryIcon(name);
  const colorClass = customColor || getCategoryColor(name);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(name);
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group overflow-hidden relative"
      onClick={onClick}
    >
      {canEdit && onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEditClick}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/40 text-white z-10"
          title="Modifier la catégorie"
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
      <CardContent className="p-0">
        <div className={`bg-gradient-to-br ${colorClass} p-6 text-white`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold">{count}</span>
          </div>
          <h3 className="text-lg font-semibold truncate">{name}</h3>
          <p className="text-sm text-white/80 mt-1">
            {count === 0 ? 'Aucun article' : count === 1 ? '1 article' : `${count} articles`}
          </p>
        </div>
        <div className="p-3 bg-card border-t border-border">
          <span className="text-sm text-primary font-medium group-hover:underline">
            Voir les articles →
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

CategoryCard.displayName = 'CategoryCard';

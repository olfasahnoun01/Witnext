import { memo, useCallback, useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { filterDecimalDraft } from '@/lib/numberInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';

interface FiltersState {
  search: string;
  size: string;
  color: string;
  priceMin: string;
  priceMax: string;
  stockStatus: string;
}

interface InventoryFiltersProps {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  availableSizes: string[];
  availableColors: string[];
}

const STOCK_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'in_stock', label: 'En Stock' },
  { value: 'low_stock', label: 'Stock Faible' },
  { value: 'out_of_stock', label: 'Rupture' },
];

export const InventoryFilters = memo(({ 
  filters, 
  onFiltersChange, 
  availableSizes, 
  availableColors 
}: InventoryFiltersProps) => {
  // Local state for search input (immediate updates)
  const [localSearch, setLocalSearch] = useState(filters.search);
  
  // Debounce search for performance
  const debouncedSearch = useDebounce(localSearch, 300);
  
  // Sync debounced search with parent
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFiltersChange]);
  
  // Keep local search in sync when filters are cleared externally
  useEffect(() => {
    if (filters.search !== localSearch && filters.search === '') {
      setLocalSearch('');
    }
  }, [filters.search]);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
  }, []);

  const handleSizeChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, size: value === 'all' ? '' : value });
  }, [filters, onFiltersChange]);

  const handleColorChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, color: value === 'all' ? '' : value });
  }, [filters, onFiltersChange]);

  const handlePriceMinChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, priceMin: value });
  }, [filters, onFiltersChange]);

  const handlePriceMaxChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, priceMax: value });
  }, [filters, onFiltersChange]);

  const handleStockStatusChange = useCallback((value: string) => {
    onFiltersChange({ ...filters, stockStatus: value === 'all' ? '' : value });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setLocalSearch('');
    onFiltersChange({
      search: '',
      size: '',
      color: '',
      priceMin: '',
      priceMax: '',
      stockStatus: '',
    });
  }, [onFiltersChange]);

  const hasActiveFilters = filters.search || filters.size || filters.color || 
    filters.priceMin || filters.priceMax || filters.stockStatus;

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher par nom, code article ou fournisseur..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            <X className="w-4 h-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtres:</span>
        </div>

        {/* Size Filter */}
        <Select value={filters.size || 'all'} onValueChange={handleSizeChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Taille" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes tailles</SelectItem>
            {availableSizes.map(size => (
              <SelectItem key={size} value={size}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Color Filter */}
        <Select value={filters.color || 'all'} onValueChange={handleColorChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Couleur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes couleurs</SelectItem>
            {availableColors.map(color => (
              <SelectItem key={color} value={color}>{color}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stock Status Filter */}
        <Select value={filters.stockStatus || 'all'} onValueChange={handleStockStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Statut stock" />
          </SelectTrigger>
          <SelectContent>
            {STOCK_STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price Range */}
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Prix min"
            value={filters.priceMin}
            onChange={(e) => handlePriceMinChange(filterDecimalDraft(e.target.value))}
            className="w-[100px]"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Prix max"
            value={filters.priceMax}
            onChange={(e) => handlePriceMaxChange(filterDecimalDraft(e.target.value))}
            className="w-[100px]"
          />
        </div>
      </div>
    </div>
  );
});

InventoryFilters.displayName = 'InventoryFilters';

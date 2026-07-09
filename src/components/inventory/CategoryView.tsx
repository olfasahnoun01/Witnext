import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product, StockStatus } from '@/types';
import { createProduct, updateProduct, deleteProduct, applyProductQuantityChange } from '@/modules/inventory';
import { fetchProductImageRef } from '@/lib/productImageStorage';
import { Button } from '@/components/ui/button';
import { InventoryFilters } from './InventoryFilters';
import { ProductTable } from './ProductTable';
import { ProductModal, ProductFormData } from './ProductModal';
import { sanitizeSearchInput, sanitizeNumericInput } from '@/lib/sanitize';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface CategoryViewProps {
  category: string;
  onBack: () => void;
}

interface FiltersState {
  search: string;
  size: string;
  color: string;
  priceMin: string;
  priceMax: string;
  stockStatus: string;
}

const ITEMS_PER_PAGE = 15;

const emptyFormData: ProductFormData = {
  name: '',
  sku: '',
  category: '',
  fournisseur: '',
  size: '',
  quantity: 0,
  price: 0,
  remise: 0,
  min_stock: 5,
  image: null,
  color: ''
};

const getStockStatus = (product: Product): StockStatus => {
  if (product.quantity === 0) return 'out_of_stock';
  if (product.quantity <= product.min_stock) return 'low_stock';
  return 'in_stock';
};

export const CategoryView = ({ category, onBack }: CategoryViewProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    size: '',
    color: '',
    priceMin: '',
    priceMax: '',
    stockStatus: '',
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch products with filters and pagination
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query for counting
      let countQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Apply category filter - handle "Non catégorisé" specially
      if (category === 'Non catégorisé') {
        countQuery = countQuery.or('category.is.null,category.eq.Non catégorisé,category.eq.');
      } else {
        countQuery = countQuery.ilike('category', category);
      }

      // Apply search filter with sanitized input
      if (filters.search) {
        const sanitizedSearch = sanitizeSearchInput(filters.search);
        if (sanitizedSearch) {
          countQuery = countQuery.or(
            `name.ilike.%${sanitizedSearch}%,sku.ilike.%${sanitizedSearch}%,fournisseur.ilike.%${sanitizedSearch}%`
          );
        }
      }

      // Apply size filter
      if (filters.size) {
        countQuery = countQuery.eq('size', filters.size);
      }

      // Apply color filter
      if (filters.color) {
        countQuery = countQuery.eq('color', filters.color);
      }

      // Apply price filters with sanitized numeric input
      const priceMin = sanitizeNumericInput(filters.priceMin);
      const priceMax = sanitizeNumericInput(filters.priceMax);
      if (priceMin !== null) {
        countQuery = countQuery.gte('price', priceMin);
      }
      if (priceMax !== null) {
        countQuery = countQuery.lte('price', priceMax);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Build query for data
      let dataQuery = supabase
        .from('products')
        .select('*');

      // Apply category filter
      if (category === 'Non catégorisé') {
        dataQuery = dataQuery.or('category.is.null,category.eq.Non catégorisé,category.eq.');
      } else {
        dataQuery = dataQuery.ilike('category', category);
      }

      // Apply search filter with sanitized input
      if (filters.search) {
        const sanitizedSearch = sanitizeSearchInput(filters.search);
        if (sanitizedSearch) {
          dataQuery = dataQuery.or(
            `name.ilike.%${sanitizedSearch}%,sku.ilike.%${sanitizedSearch}%,fournisseur.ilike.%${sanitizedSearch}%`
          );
        }
      }

      // Apply size filter
      if (filters.size) {
        dataQuery = dataQuery.eq('size', filters.size);
      }

      // Apply color filter
      if (filters.color) {
        dataQuery = dataQuery.eq('color', filters.color);
      }

      // Apply price filters with sanitized numeric input
      const priceMinData = sanitizeNumericInput(filters.priceMin);
      const priceMaxData = sanitizeNumericInput(filters.priceMax);
      if (priceMinData !== null) {
        dataQuery = dataQuery.gte('price', priceMinData);
      }
      if (priceMaxData !== null) {
        dataQuery = dataQuery.lte('price', priceMaxData);
      }

      // Order and paginate
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      dataQuery = dataQuery
        .order('name', { ascending: true })
        .range(from, to);

      const { data, error } = await dataQuery;

      if (error) throw error;

      // Apply stock status filter client-side (requires calculation)
      let filteredData = data || [];
      if (filters.stockStatus) {
        filteredData = filteredData.filter(product => {
          const status = getStockStatus(product as Product);
          return status === filters.stockStatus;
        });
      }

      setProducts(filteredData as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, [category, currentPage, filters]);

  // Fetch available filter options
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      let query = supabase.from('products').select('size, color');
      
      if (category === 'Non catégorisé') {
        query = query.or('category.is.null,category.eq.Non catégorisé,category.eq.');
      } else {
        query = query.ilike('category', category);
      }

      const { data } = await query;
      
      if (data) {
        const sizes = [...new Set(data.map(p => p.size).filter(Boolean))] as string[];
        const colors = [...new Set(data.map(p => p.color).filter(Boolean))] as string[];
        setAvailableSizes(sizes.sort());
        setAvailableColors(colors.sort());
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }, [category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Modal handlers
  const handleOpenModal = useCallback(async (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      const imageRef = await fetchProductImageRef(product.id);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        fournisseur: product.fournisseur || '',
        size: product.size || '',
        quantity: product.quantity,
        price: product.price,
        remise: product.remise || 0,
        min_stock: product.min_stock,
        image: imageRef,
        color: product.color || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ ...emptyFormData, category: category });
    }
    setIsModalOpen(true);
  }, [category]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyFormData);
  }, []);

  const handleSubmit = useCallback(async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const { quantity: newQty, ...rest } = data;
        if (newQty !== editingProduct.quantity) {
          const qtyResult = await applyProductQuantityChange(
            editingProduct.id,
            editingProduct.name,
            editingProduct.quantity,
            newQty
          );
          if (!qtyResult.success) {
            alert(qtyResult.error || 'Erreur lors de la mise à jour du stock');
            return;
          }
        }
        await updateProduct(editingProduct.id, rest);
        handleCloseModal();
        fetchProducts();
      } else {
        const result = await createProduct(data);
        if (result.success) {
          handleCloseModal();
          fetchProducts();
        } else {
          alert(result.error || 'Erreur lors de la création du produit');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [editingProduct, fetchProducts, handleCloseModal]);

  const handleDelete = useCallback(async (product: Product) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${product.name}" ?`)) {
      await deleteProduct(product.id);
      fetchProducts();
    }
  }, [fetchProducts]);

  const handleFiltersChange = useCallback((newFilters: FiltersState) => {
    setFilters(newFilters);
  }, []);

  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push(-2);
        pages.push(totalPages);
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{category}</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} article{totalCount !== 1 ? 's' : ''} dans cette catégorie
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchProducts()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Produit
          </Button>
        </div>
      </div>

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        availableSizes={availableSizes}
        availableColors={availableColors}
      />

      {/* Table */}
      <ProductTable
        products={products}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {pageNumbers.map((page, index) => (
                <PaginationItem key={index}>
                  {page < 0 ? (
                    <span className="px-3 py-2">...</span>
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingProduct={editingProduct}
        formData={formData}
        onFormDataChange={setFormData}
        isSubmitting={isSubmitting}
        defaultCategory={category}
      />
    </div>
  );
};

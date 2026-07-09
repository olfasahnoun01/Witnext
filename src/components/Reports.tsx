import { useState, useEffect } from 'react';
import { getAllProducts, getLowStockProducts } from '@/modules/inventory';
import { Product } from '@/types';
import { StandardReports } from '@/components/reports/StandardReports';
import { WarehouseDocumentsReports } from '@/components/reports/WarehouseDocumentsReports';

export const Reports = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [productsData, lowStockData] = await Promise.all([
        getAllProducts(),
        getLowStockProducts()
      ]);
      setProducts(productsData);
      setLowStockProducts(lowStockData);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <WarehouseDocumentsReports />
      <StandardReports products={products} lowStockProducts={lowStockProducts} />
    </div>
  );
};

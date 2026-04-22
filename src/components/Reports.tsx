import { useState, useEffect } from 'react';
import { getAllProducts, getLowStockProducts } from '@/services/dbService';
import { Product } from '@/types';
import { StandardReports } from '@/components/reports/StandardReports';

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
    <div className="space-y-6 animate-fade-in">
      <StandardReports products={products} lowStockProducts={lowStockProducts} />
    </div>
  );
};

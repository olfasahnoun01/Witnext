import { supabase } from '@/integrations/supabase/client';
import { Product, Transaction, DashboardStats, CategoryValue } from '@/types';

// Initialize database (now just a compatibility function)
export const initDatabase = async (): Promise<void> => {
  // No initialization needed for PostgreSQL - tables are already created
  console.log('Connected to PostgreSQL database');
};

// Save database (no-op for PostgreSQL - auto-saved)
export const saveDatabase = (): void => {
  // PostgreSQL auto-saves, no action needed
};

// Products CRUD
export const getAllProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    return [];
  }
  
  return data.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    fournisseur: p.fournisseur || '',
    size: p.size || '',
    quantity: p.quantity,
    price: Number(p.price),
    min_stock: p.min_stock,
    image: p.image || null,
    color: (p as any).color || null
  }));
};

export const getProductById = async (id: number): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Erreur lors de la récupération du produit:', error);
    return null;
  }
  
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    category: data.category,
    fournisseur: data.fournisseur || '',
    size: data.size || '',
    quantity: data.quantity,
    price: Number(data.price),
    min_stock: data.min_stock,
    image: data.image || null,
    color: (data as any).color || null
  };
};

export const createProduct = async (product: Omit<Product, 'id'>): Promise<{ success: boolean; id?: number; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        sku: product.sku,
        category: product.category,
        fournisseur: product.fournisseur || null,
        size: product.size || null,
        quantity: product.quantity,
        price: product.price,
        min_stock: product.min_stock,
        image: product.image || null,
        color: product.color || null
      } as any)
      .select()
      .single();
    
    if (error) {
      console.error('Erreur lors de la création du produit:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Ce code article existe déjà' };
      }
      return { success: false, error: error.message };
    }
    
    // Create initial transaction
    await supabase.from('transactions').insert({
      product_id: data.id,
      product_name: product.name,
      type: 'IN',
      quantity: product.quantity,
      note: 'Stock initial'
    });
    
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('Erreur lors de la création du produit:', error);
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
};

export const updateProduct = async (id: number, product: Partial<Product>): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  
  if (product.name !== undefined) updateData.name = product.name;
  if (product.sku !== undefined) updateData.sku = product.sku;
  if (product.category !== undefined) updateData.category = product.category;
  if (product.fournisseur !== undefined) updateData.fournisseur = product.fournisseur || null;
  if (product.size !== undefined) updateData.size = product.size || null;
  if (product.quantity !== undefined) updateData.quantity = product.quantity;
  if (product.price !== undefined) updateData.price = product.price;
  if (product.min_stock !== undefined) updateData.min_stock = product.min_stock;
  if (product.image !== undefined) updateData.image = product.image || null;
  if (product.color !== undefined) updateData.color = product.color || null;
  
  const { error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
  }
};

export const deleteProduct = async (id: number): Promise<void> => {
  // Transactions are deleted automatically via CASCADE
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Erreur lors de la suppression du produit:', error);
  }
};

// Transactions
export const getAllTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    return [];
  }
  
  return data.map(tx => ({
    id: tx.id,
    product_id: tx.product_id,
    product_name: tx.product_name,
    type: tx.type as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: tx.quantity,
    date: tx.date,
    note: tx.note || undefined
  }));
};

export const createTransaction = async (tx: Omit<Transaction, 'id'>): Promise<{ success: boolean; error?: string }> => {
  // Get current product quantity
  const product = await getProductById(tx.product_id);
  if (!product) {
    return { success: false, error: 'Produit non trouvé' };
  }
  
  let newQuantity = product.quantity;
  if (tx.type === 'IN') {
    newQuantity += tx.quantity;
  } else if (tx.type === 'OUT') {
    newQuantity -= tx.quantity;
    if (newQuantity < 0) {
      return { success: false, error: 'Stock insuffisant' };
    }
  } else {
    newQuantity = tx.quantity;
  }
  
  // Update product quantity
  await updateProduct(tx.product_id, { quantity: newQuantity });
  
  // Create transaction
  const { error } = await supabase.from('transactions').insert({
    product_id: tx.product_id,
    product_name: tx.product_name,
    type: tx.type,
    quantity: tx.quantity,
    date: tx.date,
    note: tx.note || null
  });
  
  if (error) {
    console.error('Erreur lors de la création de la transaction:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
};

// Dashboard Stats
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const products = await getAllProducts();
  
  const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= p.min_stock).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  
  // Group by category
  const categoryMap: Record<string, number> = {};
  products.forEach(p => {
    if (!categoryMap[p.category]) {
      categoryMap[p.category] = 0;
    }
    categoryMap[p.category] += p.price * p.quantity;
  });
  
  const categoryValues: CategoryValue[] = Object.entries(categoryMap).map(([category, value]) => ({
    category,
    value
  }));
  
  return { totalValue, totalProducts, lowStockCount, outOfStockCount, categoryValues };
};

// Export/Import Database - now exports data as JSON
export const exportDatabase = async (): Promise<Uint8Array | null> => {
  const products = await getAllProducts();
  const transactions = await getAllTransactions();
  
  const data = JSON.stringify({ products, transactions }, null, 2);
  const encoder = new TextEncoder();
  return encoder.encode(data);
};

export const importDatabase = async (data: Uint8Array): Promise<void> => {
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(data);
  
  try {
    const { products, transactions } = JSON.parse(jsonString);
    
    // Clear existing data
    await supabase.from('transactions').delete().neq('id', 0);
    await supabase.from('products').delete().neq('id', 0);
    
    // Insert products
    for (const product of products) {
      const { id, ...productData } = product;
      await supabase.from('products').insert(productData);
    }
    
    // Insert transactions
    for (const tx of transactions) {
      const { id, ...txData } = tx;
      await supabase.from('transactions').insert(txData);
    }
    
    console.log('Base de données importée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    throw error;
  }
};

export const getRecentTransactions = async (limit: number = 10): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    return [];
  }
  
  return data.map(tx => ({
    id: tx.id,
    product_id: tx.product_id,
    product_name: tx.product_name,
    type: tx.type as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: tx.quantity,
    date: tx.date,
    note: tx.note || undefined
  }));
};

export const getLowStockProducts = async (): Promise<Product[]> => {
  // Get all products and filter in JS since we can't compare columns directly in Supabase
  const products = await getAllProducts();
  return products.filter(p => p.quantity <= p.min_stock).sort((a, b) => a.quantity - b.quantity);
};

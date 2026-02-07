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
    remise: Number(p.remise) || 0,
    prix_ttc: Number(p.prix_ttc) || Number(p.price),
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
    remise: Number(data.remise) || 0,
    prix_ttc: Number(data.prix_ttc) || Number(data.price),
    min_stock: data.min_stock,
    image: data.image || null,
    color: (data as any).color || null
  };
};

export const createProduct = async (product: Omit<Product, 'id' | 'prix_ttc'>): Promise<{ success: boolean; id?: number; error?: string }> => {
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
        remise: product.remise || 0,
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
  if (product.remise !== undefined) updateData.remise = product.remise;
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

// Database schema definition for export/documentation
const DATABASE_SCHEMA = {
  version: 2,
  tables: {
    clients: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'nom', type: 'text', nullable: false },
        { name: 'phone', type: 'text', nullable: true },
        { name: 'location', type: 'text', nullable: true },
        { name: 'matricule_fiscale', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    },
    fournisseurs: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'nom', type: 'text', nullable: false },
        { name: 'specialite', type: 'text', nullable: false },
        { name: 'phone', type: 'text', nullable: true },
        { name: 'location', type: 'text', nullable: true },
        { name: 'matricule_fiscale', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    },
    product_groups: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'name', type: 'text', nullable: false },
        { name: 'category', type: 'text', nullable: false },
        { name: 'base_sku', type: 'text', nullable: true },
        { name: 'fournisseur', type: 'text', nullable: true },
        { name: 'min_stock', type: 'integer', default: 5 },
        { name: 'image', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    },
    products: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'name', type: 'text', nullable: false },
        { name: 'sku', type: 'text', nullable: false, unique: true },
        { name: 'category', type: 'text', nullable: false },
        { name: 'fournisseur', type: 'text', nullable: true },
        { name: 'size', type: 'text', nullable: true },
        { name: 'color', type: 'text', nullable: true },
        { name: 'quantity', type: 'integer', default: 0 },
        { name: 'price', type: 'numeric', default: 0 },
        { name: 'remise', type: 'numeric', default: 0 },
        { name: 'prix_ttc', type: 'numeric', nullable: true },
        { name: 'min_stock', type: 'integer', default: 5 },
        { name: 'image', type: 'text', nullable: true },
        { name: 'product_group_id', type: 'integer', nullable: true, references: 'product_groups.id' },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    },
    transactions: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'product_id', type: 'integer', nullable: false, references: 'products.id' },
        { name: 'product_name', type: 'text', nullable: false },
        { name: 'type', type: 'text', nullable: false },
        { name: 'quantity', type: 'integer', nullable: false },
        { name: 'date', type: 'timestamp', default: 'now()' },
        { name: 'note', type: 'text', nullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' }
      ]
    },
    documents: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'doc_number', type: 'text', nullable: false },
        { name: 'type', type: 'text', nullable: false },
        { name: 'doc_date', type: 'date', default: 'CURRENT_DATE' },
        { name: 'items', type: 'jsonb', default: '[]' },
        { name: 'total_amount', type: 'numeric', default: 0 },
        { name: 'third_party_name', type: 'text', nullable: true },
        { name: 'third_party_address', type: 'text', nullable: true },
        { name: 'third_party_tax_id', type: 'text', nullable: true },
        { name: 'transport_ref', type: 'text', nullable: true },
        { name: 'validity', type: 'text', nullable: true },
        { name: 'created_by', type: 'uuid', nullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    },
    orders: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'client_name', type: 'text', nullable: false },
        { name: 'client_phone', type: 'text', nullable: true },
        { name: 'client_description', type: 'text', nullable: true },
        { name: 'items', type: 'jsonb', nullable: false },
        { name: 'total_amount', type: 'numeric', default: 0 },
        { name: 'status', type: 'text', default: 'En attente' },
        { name: 'created_at', type: 'timestamp', default: 'now()' }
      ]
    },
    product_group_fournisseurs: {
      columns: [
        { name: 'id', type: 'integer', primary: true, auto_increment: true },
        { name: 'product_group_id', type: 'integer', nullable: false, references: 'product_groups.id' },
        { name: 'fournisseur_name', type: 'text', nullable: false },
        { name: 'prix_ttc', type: 'numeric', default: 0 },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' }
      ]
    }
  }
};

// Export/Import Database - exports ALL business data and schema as JSON
export const exportDatabase = async (): Promise<Uint8Array | null> => {
  try {
    // Fetch all business data tables
    const [
      { data: products },
      { data: transactions },
      { data: clients },
      { data: fournisseurs },
      { data: documents },
      { data: orders },
      { data: product_groups },
      { data: product_group_fournisseurs }
    ] = await Promise.all([
      supabase.from('products').select('*').order('id'),
      supabase.from('transactions').select('*').order('id'),
      supabase.from('clients').select('*').order('id'),
      supabase.from('fournisseurs').select('*').order('id'),
      supabase.from('documents').select('*').order('id'),
      supabase.from('orders').select('*').order('id'),
      supabase.from('product_groups').select('*').order('id'),
      supabase.from('product_group_fournisseurs').select('*').order('id')
    ]);

    const exportData = {
      _metadata: {
        version: 2,
        exportDate: new Date().toISOString(),
        application: 'Grosafe Gestion',
        format: 'grosafe-backup'
      },
      schema: DATABASE_SCHEMA,
      data: {
        clients: clients || [],
        fournisseurs: fournisseurs || [],
        product_groups: product_groups || [],
        products: products || [],
        transactions: transactions || [],
        documents: documents || [],
        orders: orders || [],
        product_group_fournisseurs: product_group_fournisseurs || []
      }
    };

    const data = JSON.stringify(exportData, null, 2);
    const encoder = new TextEncoder();
    return encoder.encode(data);
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    return null;
  }
};

// Helper function to insert data into a table
const insertTableData = async (
  tableName: 'clients' | 'fournisseurs' | 'documents' | 'orders' | 'product_groups' | 'products' | 'product_group_fournisseurs' | 'transactions',
  items: any[]
): Promise<void> => {
  for (const item of items) {
    try {
      const { id, ...itemData } = item;
      
      const { error } = await supabase
        .from(tableName)
        .insert(itemData as any);
      
      if (error) {
        if (error.code === '23505') {
          console.log(`Duplicate entry skipped in ${tableName}`);
        } else {
          console.error(`Error inserting into ${tableName}:`, error);
        }
      }
    } catch (err) {
      console.error(`Error processing item in ${tableName}:`, err);
    }
  }
};

export const importDatabase = async (data: Uint8Array): Promise<void> => {
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(data);
  
  try {
    const importData = JSON.parse(jsonString);
    
    // Handle different export formats
    let dataToImport: any;
    
    // New format with _metadata and data
    if (importData._metadata && importData.data) {
      dataToImport = importData.data;
    } 
    // Old v2 format with version at root
    else if (importData.version === 2) {
      dataToImport = {
        products: importData.products || [],
        transactions: importData.transactions || [],
        clients: importData.clients || [],
        fournisseurs: importData.fournisseurs || [],
        documents: importData.documents || [],
        orders: importData.orders || [],
        product_groups: importData.product_groups || [],
        product_group_fournisseurs: importData.product_group_fournisseurs || []
      };
    }
    // Old v1 format (only products and transactions)
    else {
      dataToImport = {
        products: importData.products || [],
        transactions: importData.transactions || [],
        clients: [],
        fournisseurs: [],
        documents: [],
        orders: [],
        product_groups: [],
        product_group_fournisseurs: []
      };
    }

    const {
      products = [],
      transactions = [],
      clients = [],
      fournisseurs = [],
      documents = [],
      orders = [],
      product_groups = [],
      product_group_fournisseurs = []
    } = dataToImport;

    // Delete in correct order (respecting foreign key constraints)
    console.log('Suppression des données existantes...');
    await supabase.from('transactions').delete().gte('id', 0);
    await supabase.from('product_group_fournisseurs').delete().gte('id', 0);
    await supabase.from('products').delete().gte('id', 0);
    await supabase.from('product_groups').delete().gte('id', 0);
    await supabase.from('documents').delete().gte('id', 0);
    await supabase.from('orders').delete().gte('id', 0);
    await supabase.from('clients').delete().gte('id', 0);
    await supabase.from('fournisseurs').delete().gte('id', 0);

    // Insert in correct order (respecting foreign key constraints)
    console.log('Importation des clients...');
    await insertTableData('clients', clients);

    console.log('Importation des fournisseurs...');
    await insertTableData('fournisseurs', fournisseurs);

    console.log('Importation des documents...');
    await insertTableData('documents', documents);

    console.log('Importation des commandes...');
    await insertTableData('orders', orders);

    console.log('Importation des groupes de produits...');
    await insertTableData('product_groups', product_groups);

    console.log('Importation des produits...');
    await insertTableData('products', products);

    console.log('Importation des fournisseurs de groupes...');
    await insertTableData('product_group_fournisseurs', product_group_fournisseurs);

    console.log('Importation des transactions...');
    await insertTableData('transactions', transactions);
    
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
  // Use a direct query with raw filter to compare quantity with min_stock
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('quantity', { ascending: true });
  
  if (error) {
    console.error('Erreur lors de la récupération des produits en stock faible:', error);
    return [];
  }
  
  // Filter products where quantity <= min_stock
  return data
    .filter(p => p.quantity <= p.min_stock)
    .map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      fournisseur: p.fournisseur || '',
      size: p.size || '',
      quantity: p.quantity,
      price: Number(p.price),
      remise: Number(p.remise) || 0,
      prix_ttc: Number(p.prix_ttc) || Number(p.price),
      min_stock: p.min_stock,
      image: p.image || null,
      color: (p as any).color || null
    }));
};

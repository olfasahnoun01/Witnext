import { supabase } from '@/integrations/supabase/client';
import { Product, Transaction, DashboardStats, CategoryValue } from '@/types';
import JSZip from 'jszip';

// Initialize database (now just a compatibility function)
export const initDatabase = async (): Promise<void> => {
  // No initialization needed for PostgreSQL - tables are already created
  console.log('Connected to PostgreSQL database');
};

// Save database (no-op for PostgreSQL - auto-saved)
export const saveDatabase = (): void => {
  // PostgreSQL auto-saves, no action needed
};

// Lightweight product columns (no image blob)
const PRODUCT_COLUMNS_LIGHT = 'id,name,sku,category,fournisseur,size,color,quantity,price,remise,prix_ttc,min_stock,product_group_id' as const;

const mapProduct = (p: any, includeImage = false): Product => ({
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
  image: includeImage ? (p.image || null) : null,
  color: p.color || null,
  product_group_id: p.product_group_id
});

// Products CRUD - lightweight (no images)
export const getAllProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_LIGHT)
    .order('name');
  
  if (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    return [];
  }
  
  return data.map(p => mapProduct(p));
};

// Full product with image - use only when displaying a single product
export const getProductWithImage = async (id: number): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error || !data) return null;
  return mapProduct(data, true);
};

export const getProductById = async (id: number): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_LIGHT)
    .eq('id', id)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Erreur lors de la récupération du produit:', error);
    return null;
  }
  
  return mapProduct(data);
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

// Dashboard Stats - uses server-side aggregation
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  
  if (error) {
    console.error('Error fetching dashboard stats:', error);
    return { totalValue: 0, totalProducts: 0, lowStockCount: 0, outOfStockCount: 0, categoryValues: [] };
  }
  
  const stats = data as any;
  return {
    totalValue: Number(stats.totalValue) || 0,
    totalProducts: Number(stats.totalProducts) || 0,
    lowStockCount: Number(stats.lowStockCount) || 0,
    outOfStockCount: Number(stats.outOfStockCount) || 0,
    categoryValues: (stats.categoryValues || []).map((cv: any) => ({
      category: cv.category,
      value: Number(cv.value) || 0
    }))
  };
};

// Helper to fetch ALL rows from a table (handles Supabase 1000-row limit)
const fetchAllRows = async (tableName: string): Promise<any[]> => {
  const allRows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await (supabase
      .from(tableName as any)
      .select('*') as any)
      .order('id')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
};

// Same but for tables with uuid id
const fetchAllRowsUuid = async (tableName: string, orderCol = 'created_at'): Promise<any[]> => {
  const allRows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await (supabase
      .from(tableName as any)
      .select('*') as any)
      .order(orderCol)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
};

// Export/Import Database - exports ALL data and storage files as ZIP
export const exportDatabase = async (onProgress?: (message: string) => void): Promise<Blob | null> => {
  try {
    onProgress?.('Récupération des données...');
    
    // Fetch ALL rows from every table (handles >1000 rows)
    const [
      products, transactions, clients, fournisseurs, documents,
      orders, product_groups, product_group_fournisseurs, devis,
      profiles, user_roles, user_presence, team_chat_messages
    ] = await Promise.all([
      fetchAllRows('products'),
      fetchAllRows('transactions'),
      fetchAllRows('clients'),
      fetchAllRows('fournisseurs'),
      fetchAllRows('documents'),
      fetchAllRows('orders'),
      fetchAllRows('product_groups'),
      fetchAllRows('product_group_fournisseurs'),
      fetchAllRows('devis'),
      fetchAllRowsUuid('profiles'),
      fetchAllRowsUuid('user_roles'),
      fetchAllRowsUuid('user_presence'),
      fetchAllRowsUuid('team_chat_messages'),
    ]);

    const exportData = {
      _metadata: {
        version: 4,
        exportDate: new Date().toISOString(),
        application: 'Grosafe Gestion',
        format: 'grosafe-backup'
      },
      data: {
        clients,
        fournisseurs,
        product_groups,
        products,
        transactions,
        documents,
        orders,
        product_group_fournisseurs,
        devis,
        profiles,
        user_roles,
        user_presence,
        team_chat_messages,
      }
    };

    const zip = new JSZip();
    zip.file('data.json', JSON.stringify(exportData, null, 2));

    // Download all files from storage buckets
    onProgress?.('Récupération des fichiers stockés...');
    
    try {
      const { data: storageFiles, error: listError } = await supabase.storage
        .from('fiches-techniques')
        .list('fiches', { limit: 1000 });
      
      if (!listError && storageFiles && storageFiles.length > 0) {
        const storageFolder = zip.folder('fiches-techniques');
        let downloadedCount = 0;
        
        for (const file of storageFiles) {
          if (file.name === '.emptyFolderPlaceholder') continue;
          try {
            onProgress?.(`Téléchargement fichier ${++downloadedCount}/${storageFiles.length}...`);
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('fiches-techniques')
              .download(`fiches/${file.name}`);
            
            if (!downloadError && fileData) {
              storageFolder?.file(file.name, fileData);
            }
          } catch (err) {
            console.warn(`Could not download file ${file.name}:`, err);
          }
        }
      }
    } catch (storageError) {
      console.warn('Could not export storage files:', storageError);
    }

    onProgress?.('Création du fichier ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return zipBlob;
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    return null;
  }
};

// Helper function to insert data into any table
const insertTableData = async (
  tableName: string,
  items: any[],
  stripId = true
): Promise<void> => {
  for (const item of items) {
    try {
      const insertData = stripId ? (() => { const { id, ...rest } = item; return rest; })() : { ...item };
      
      const { error } = await (supabase
        .from(tableName as any)
        .insert(insertData as any) as any);
      
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

export const importDatabase = async (file: Blob, onProgress?: (message: string) => void): Promise<void> => {
  try {
    let importData: any;
    let storageFiles: { name: string; data: Blob }[] = [];

    // Check if it's a ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const isZip = header[0] === 0x50 && header[1] === 0x4B;

    if (isZip) {
      onProgress?.('Extraction du fichier ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const dataFile = zip.file('data.json');
      if (!dataFile) throw new Error('Fichier data.json manquant dans le ZIP');
      const jsonString = await dataFile.async('string');
      importData = JSON.parse(jsonString);

      const fichesFolder = zip.folder('fiches-techniques');
      if (fichesFolder) {
        const filePromises: Promise<void>[] = [];
        fichesFolder.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            filePromises.push(
              zipEntry.async('blob').then(blob => {
                storageFiles.push({ name: relativePath, data: blob });
              })
            );
          }
        });
        await Promise.all(filePromises);
      }
    } else {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
      importData = JSON.parse(jsonString);
    }
    
    // Handle different export formats
    let dataToImport: any;
    
    if (importData._metadata && importData.data) {
      dataToImport = importData.data;
    } else if (importData.version === 2) {
      dataToImport = {
        products: importData.products || [],
        transactions: importData.transactions || [],
        clients: importData.clients || [],
        fournisseurs: importData.fournisseurs || [],
        documents: importData.documents || [],
        orders: importData.orders || [],
        product_groups: importData.product_groups || [],
        product_group_fournisseurs: importData.product_group_fournisseurs || [],
        devis: importData.devis || []
      };
    } else {
      dataToImport = {
        products: importData.products || [],
        transactions: importData.transactions || [],
        clients: [],
        fournisseurs: [],
        documents: [],
        orders: [],
        product_groups: [],
        product_group_fournisseurs: [],
        devis: []
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
      product_group_fournisseurs = [],
      devis = [],
      profiles = [],
      user_roles = [],
      user_presence = [],
      team_chat_messages = []
    } = dataToImport;

    // Delete in correct order (respecting foreign key constraints)
    onProgress?.('Suppression des données existantes...');
    await (supabase.from('team_chat_messages' as any).delete() as any).gte('created_at', '1970-01-01');
    await (supabase.from('user_presence' as any).delete() as any).gte('last_seen', '1970-01-01');
    await supabase.from('transactions').delete().gte('id', 0);
    await supabase.from('product_group_fournisseurs').delete().gte('id', 0);
    await supabase.from('products').delete().gte('id', 0);
    await supabase.from('product_groups').delete().gte('id', 0);
    await supabase.from('documents').delete().gte('id', 0);
    await supabase.from('devis').delete().gte('id', 0);
    await supabase.from('orders').delete().gte('id', 0);
    await supabase.from('clients').delete().gte('id', 0);
    await supabase.from('fournisseurs').delete().gte('id', 0);

    // Insert in correct order
    onProgress?.('Importation des clients...');
    await insertTableData('clients', clients);

    onProgress?.('Importation des fournisseurs...');
    await insertTableData('fournisseurs', fournisseurs);

    onProgress?.('Importation des documents...');
    await insertTableData('documents', documents);

    onProgress?.('Importation des devis...');
    await insertTableData('devis', devis);

    onProgress?.('Importation des commandes...');
    await insertTableData('orders', orders);

    onProgress?.('Importation des groupes de produits...');
    await insertTableData('product_groups', product_groups);

    onProgress?.('Importation des produits...');
    await insertTableData('products', products);

    onProgress?.('Importation des fournisseurs de groupes...');
    await insertTableData('product_group_fournisseurs', product_group_fournisseurs);

    onProgress?.('Importation des transactions...');
    await insertTableData('transactions', transactions);

    // Import user-related data (profiles, roles, presence, chat)
    if (profiles.length > 0) {
      onProgress?.('Importation des profils...');
      await insertTableData('profiles', profiles, false);
    }

    if (user_roles.length > 0) {
      onProgress?.('Importation des rôles...');
      await insertTableData('user_roles', user_roles, false);
    }

    if (user_presence.length > 0) {
      onProgress?.('Importation de la présence...');
      await insertTableData('user_presence', user_presence, false);
    }

    if (team_chat_messages.length > 0) {
      onProgress?.('Importation des messages...');
      await insertTableData('team_chat_messages', team_chat_messages, false);
    }

    // Upload storage files
    if (storageFiles.length > 0) {
      onProgress?.(`Restauration de ${storageFiles.length} fichier(s)...`);
      for (const sf of storageFiles) {
        try {
          await supabase.storage
            .from('fiches-techniques')
            .upload(`fiches/${sf.name}`, sf.data, { upsert: true });
        } catch (err) {
          console.warn(`Could not restore file ${sf.name}:`, err);
        }
      }
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
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_LIGHT)
    .order('quantity', { ascending: true });
  
  if (error) {
    console.error('Erreur lors de la récupération des produits en stock faible:', error);
    return [];
  }
  
  return data
    .filter(p => p.quantity <= p.min_stock)
    .map(p => mapProduct(p));
};

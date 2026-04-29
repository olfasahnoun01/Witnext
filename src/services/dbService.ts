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
  const allData: any[] = [];
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 30;
  let from = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > MAX_PAGES) {
      console.warn(`getAllProducts: stopped after ${MAX_PAGES * PAGE_SIZE} rows (safety cap).`);
      break;
    }
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS_LIGHT)
      .order('name')
      .range(from, from + PAGE_SIZE - 1);
    
    if (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      break;
    }

    const batch = data || [];
    allData.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  
  return allData.map(p => mapProduct(p));
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

// Helper: recursively list all files in a storage bucket
const listAllStorageFiles = async (bucket: string, prefix = ''): Promise<string[]> => {
  const allPaths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return allPaths;

  for (const item of data) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      // It's a file
      allPaths.push(fullPath);
    } else {
      // It's a folder — recurse
      const subFiles = await listAllStorageFiles(bucket, fullPath);
      allPaths.push(...subFiles);
    }
  }
  return allPaths;
};

// Helper: extract storage path from a public URL
const extractStoragePath = (url: string, bucket: string): string | null => {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) return url.substring(idx + marker.length);
  return null;
};

// Helper: parse fiche_technique_url which can be a JSON array or single URL
const parseFicheUrls = (value: string | null | undefined): string[] => {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return [trimmed]; }
  }
  return [trimmed];
};

// Helper: sanitize a string for use as a folder name
const sanitizeFolderName = (name: string): string => {
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim() || '_unnamed';
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
        version: 5,
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

    // Build mapping: storage path → article (product group) name
    onProgress?.('Construction du mapping fichiers → articles...');
    
    const groupNameById = new Map<number, string>();
    for (const g of product_groups) {
      groupNameById.set(g.id, g.name);
    }

    // Map: storage path → article folder name
    const pathToArticle = new Map<string, string>();
    const bucket = 'fiches-techniques';

    const mapUrlToArticle = (url: string, articleName: string) => {
      const path = extractStoragePath(url, bucket);
      if (path) pathToArticle.set(path, sanitizeFolderName(articleName));
    };

    // From products (variants) — map via product_group_id
    for (const p of products) {
      const groupName = p.product_group_id ? groupNameById.get(p.product_group_id) : null;
      const articleName = groupName || p.name;
      
      for (const url of parseFicheUrls(p.fiche_technique_url)) {
        mapUrlToArticle(url, articleName);
      }
      if (p.image) mapUrlToArticle(p.image, articleName);
    }

    // From product_group_fournisseurs
    for (const pgf of product_group_fournisseurs) {
      const groupName = groupNameById.get(pgf.product_group_id);
      if (groupName) {
        for (const url of parseFicheUrls(pgf.fiche_technique_url)) {
          mapUrlToArticle(url, groupName);
        }
      }
    }

    // From product_groups (group images)
    for (const g of product_groups) {
      if (g.image) mapUrlToArticle(g.image, g.name);
    }

    // List ALL files in storage recursively
    onProgress?.('Récupération de la liste des fichiers stockés...');
    let allStoragePaths: string[] = [];
    try {
      allStoragePaths = await listAllStorageFiles(bucket);
    } catch (err) {
      console.warn('Could not list storage files:', err);
    }

    // Download and organize files into article-named folders
    if (allStoragePaths.length > 0) {
      const storageFolder = zip.folder('fiches-techniques');
      let downloadedCount = 0;

      for (const filePath of allStoragePaths) {
        try {
          onProgress?.(`Téléchargement fichier ${++downloadedCount}/${allStoragePaths.length}...`);
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(filePath);
          
          if (!downloadError && fileData) {
            const articleFolder = pathToArticle.get(filePath) || '_unlinked';
            const fileName = filePath.split('/').pop() || filePath;
            storageFolder?.file(`${articleFolder}/${fileName}`, fileData);
          }
        } catch (err) {
          console.warn(`Could not download file ${filePath}:`, err);
        }
      }
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
  if (!items.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  for (const item of items) {
    try {
      // Create a clean copy of the data
      let insertData = { ...item };
      
      // Strip internal database ID if requested
      if (stripId) {
        delete (insertData as any).id;
      }
      
      // Strip generated columns (PostgreSQL does not allow inserting into these)
      delete (insertData as any).prix_ttc;
      
      // IMPORTANT Fix for Migration: Handle User Ownership
      let currentUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
      } catch (e) {
        console.warn('Could not get current user, proceeding without ownership override');
      }

      // If we are migrating to a new project, the original user IDs (created_by, user_id) 
      // will cause "Foreign Key Violation (23503)" because those users don't exist yet.
      // We force these to the CURRENT user doing the import so the data is valid.
      if (currentUserId) {
        const originalUserId = (insertData as any).user_id;

        // Profiles special handling: 
        // We only import the CURRENT user's profile to avoid conflicts with non-existent auth users.
        if (tableName === 'profiles' && originalUserId && originalUserId !== currentUserId) {
          console.log('Skipping non-current user profile to prevent auth violation');
          continue;
        }

        // User Roles special handling:
        // We only import the CURRENT user's roles to avoid unique constraint violations
        if (tableName === 'user_roles' && originalUserId && originalUserId !== currentUserId) {
          console.log('Skipping non-current user role to prevent auth violation');
          continue;
        }
        
        // Force ownership to CURRENT user for all other tables/records to avoid FK or RLS violations
        if ('created_by' in insertData) (insertData as any).created_by = currentUserId;
        if ('user_id' in insertData) (insertData as any).user_id = currentUserId;
        if ('updated_by' in insertData) (insertData as any).updated_by = currentUserId;
      }
      
      // Select the correct conflict target for each table to avoid 409 errors
      let upsertOptions: any = {};
      if (tableName === 'profiles') upsertOptions.onConflict = 'user_id';
      if (tableName === 'user_roles') upsertOptions.onConflict = 'user_id,role';
      if (tableName === 'product_groups') upsertOptions.onConflict = 'name,category';
      if (tableName === 'product_group_fournisseurs') upsertOptions.onConflict = 'product_group_id,fournisseur_name';
      if (tableName === 'category_settings') upsertOptions.onConflict = 'category_name';
      if (tableName === 'user_presence') upsertOptions.onConflict = 'user_id';
      
      // Use upsert for EVERYTHING during import to prevent 409 Conflict errors
      const { error } = await supabase
        .from(tableName as any)
        .upsert(insertData as any, upsertOptions);
      
      if (error) {
        // Log but don't stop the whole import
        console.error(`Error importing into ${tableName}:`, error.code, error.message);
      }
    } catch (err) {
      console.error(`Unexpected process error in ${tableName}:`, err);
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
            // relativePath could be "ArticleName/file.jpeg" (v5+) or "file.webp" (legacy v4/v5)
            const fileName = relativePath.split('/').pop() || relativePath;
            filePromises.push(
              zipEntry.async('blob').then(blob => {
                storageFiles.push({ name: fileName, data: blob });
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

    // Insert in correct order (preserving original IDs to maintain foreign key links)
    onProgress?.('Importation des clients...');
    await insertTableData('clients', clients, false);

    onProgress?.('Importation des fournisseurs...');
    await insertTableData('fournisseurs', fournisseurs, false);

    onProgress?.('Importation des documents...');
    await insertTableData('documents', documents, false);

    onProgress?.('Importation des devis...');
    await insertTableData('devis', devis, false);

    onProgress?.('Importation des commandes...');
    await insertTableData('orders', orders, false);

    onProgress?.('Importation des groupes de produits...');
    await insertTableData('product_groups', product_groups, false);

    onProgress?.('Importation des produits...');
    await insertTableData('products', products, false);

    onProgress?.('Importation des fournisseurs de groupes...');
    await insertTableData('product_group_fournisseurs', product_group_fournisseurs, false);

    onProgress?.('Importation des transactions...');
    await insertTableData('transactions', transactions, false);

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

    // Upload storage files — rebuild original paths from data.json URLs
    if (storageFiles.length > 0) {
      onProgress?.(`Restauration de ${storageFiles.length} fichier(s)...`);
      
      // Build a map: fileName → original storage path from all URL fields in data
      const fileNameToPath = new Map<string, string>();
      const bucket = 'fiches-techniques';
      
      const registerUrl = (url: string) => {
        const path = extractStoragePath(url, bucket);
        if (path) {
          const fn = path.split('/').pop();
          if (fn) fileNameToPath.set(fn, path);
        }
      };
      
      for (const p of products) {
        for (const u of parseFicheUrls(p.fiche_technique_url)) registerUrl(u);
        if (p.image) registerUrl(p.image);
      }
      for (const pgf of product_group_fournisseurs) {
        for (const u of parseFicheUrls(pgf.fiche_technique_url)) registerUrl(u);
      }
      for (const g of product_groups) {
        if (g.image) registerUrl(g.image);
      }

      for (const sf of storageFiles) {
        try {
          // Use original path from data.json, fallback to fiches/filename
          const storagePath = fileNameToPath.get(sf.name) || `fiches/${sf.name}`;
          await supabase.storage
            .from(bucket)
            .upload(storagePath, sf.data, { upsert: true });
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

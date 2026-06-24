import { supabase } from '@/integrations/supabase/client';
import { Product, Transaction, DashboardStats, CategoryValue } from '@/types';
import { getActiveCompanyId, getActiveCompanyIdForQuery, requireActiveCompanyId, withCompany } from '@/lib/activeCompany';
import { persistProductImageIfInline, fetchProductImageRefsForBackup } from '@/lib/productImageStorage';
import {
  BACKUP_COMPANY_SCOPED_TABLES,
  BACKUP_EXTENDED_IMPORT_ORDER,
  BACKUP_EXTENDED_TABLES,
  BACKUP_FORMAT_VERSION,
  BACKUP_UPSERT_CONFLICT,
  type BackupFetchMode,
} from '@/lib/dbBackupTables';
import {
  PRODUCT_EXPORT_COLUMNS,
  PRODUCT_GROUP_EXPORT_COLUMNS,
} from '@/lib/productQueryColumns';
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
    const companyId = getActiveCompanyIdForQuery();
    if (!companyId) {
      if (from === 0) return [];
      break;
    }
    let query = supabase
      .from('products')
      .select(PRODUCT_COLUMNS_LIGHT)
      .order('name')
      .range(from, from + PAGE_SIZE - 1)
      .eq('company_id' as any, companyId);

    const { data, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      throw new Error(error.message || 'Erreur lors de la récupération des produits');
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
    const companyId = requireActiveCompanyId();
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        sku: product.sku,
        category: product.category,
        fournisseur: product.fournisseur || null,
        size: product.size || null,
        quantity: 0,
        price: product.price,
        remise: product.remise || 0,
        min_stock: product.min_stock,
        image: null,
        color: product.color || null,
        company_id: companyId,
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

    if (product.image) {
      const imagePath = await persistProductImageIfInline(product.image, `product-${data.id}.webp`);
      if (imagePath) {
        const { error: imageError } = await supabase
          .from('products')
          .update({ image: imagePath })
          .eq('id', data.id);
        if (imageError) {
          console.error('Erreur image produit:', imageError);
        }
      }
    }

    if (product.quantity > 0) {
      const { error: stockError } = await supabase.rpc('create_stock_transaction', {
        p_product_id: data.id,
        p_product_name: product.name,
        p_type: 'IN',
        p_quantity: product.quantity,
        p_date: new Date().toISOString(),
        p_note: 'Stock initial',
      });
      if (stockError) {
        return {
          success: true,
          id: data.id,
          error: `Article créé, mais le stock initial n'a pas pu être enregistré: ${stockError.message}`,
        };
      }
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('Erreur lors de la création du produit:', error);
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
};

export const updateProduct = async (id: number, product: Partial<Product>): Promise<void> => {
  if (product.quantity !== undefined) {
    throw new Error('La quantité doit être modifiée via une transaction stock (createTransaction).');
  }

  const updateData: Record<string, unknown> = {};
  
  if (product.name !== undefined) updateData.name = product.name;
  if (product.sku !== undefined) updateData.sku = product.sku;
  if (product.category !== undefined) updateData.category = product.category;
  if (product.fournisseur !== undefined) updateData.fournisseur = product.fournisseur || null;
  if (product.size !== undefined) updateData.size = product.size || null;
  if (product.price !== undefined) updateData.price = product.price;
  if (product.remise !== undefined) updateData.remise = product.remise;
  if (product.min_stock !== undefined) updateData.min_stock = product.min_stock;
  if (product.image !== undefined) {
    updateData.image = product.image
      ? await persistProductImageIfInline(product.image, `product-${id}.webp`)
      : null;
  }
  if (product.color !== undefined) updateData.color = product.color || null;
  
  const { error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    throw new Error(error.message);
  }
};

export const deleteProduct = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    throw new Error(error.message || 'Erreur lors de la suppression du produit');
  }
};

// Transactions
export const getAllTransactions = async (): Promise<Transaction[]> => {
  const companyId = getActiveCompanyIdForQuery();
  if (!companyId) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id' as any, companyId)
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

export const createTransaction = async (
  tx: Omit<Transaction, 'id'>
): Promise<{ success: boolean; error?: string; transactionId?: number }> => {
  const dateIso =
    typeof tx.date === 'string' && tx.date.length <= 10
      ? `${tx.date}T12:00:00.000Z`
      : tx.date;

  const { data, error } = await supabase.rpc('create_stock_transaction', {
    p_product_id: tx.product_id,
    p_product_name: tx.product_name,
    p_type: tx.type,
    p_quantity: tx.quantity,
    p_date: dateIso,
    p_note: tx.note ?? null,
  });

  if (error) {
    console.error('Erreur lors de la création de la transaction:', error);
    const msg = error.message || '';
    if (msg.includes('insufficient stock')) {
      return { success: false, error: 'Stock insuffisant' };
    }
    if (msg.includes('product not found')) {
      return { success: false, error: 'Produit non trouvé' };
    }
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; transaction_id?: number } | null;
  if (result?.success === false) {
    return { success: false, error: 'Échec transaction stock' };
  }
  return { success: true, transactionId: result?.transaction_id };
};

/** Stock change via transaction ledger (avoids silent quantity-only updates). */
export const applyProductQuantityChange = async (
  productId: number,
  productName: string,
  fromQty: number,
  toQty: number
): Promise<{ success: boolean; error?: string }> => {
  if (toQty === fromQty) return { success: true };
  const date = new Date().toISOString().slice(0, 10);
  if (toQty > fromQty) {
    return createTransaction({
      product_id: productId,
      product_name: productName,
      type: 'IN',
      quantity: toQty - fromQty,
      date,
    });
  }
  return createTransaction({
    product_id: productId,
    product_name: productName,
    type: 'OUT',
    quantity: fromQty - toQty,
    date,
  });
};

// Dashboard Stats - uses server-side aggregation
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const companyId = requireActiveCompanyId();
  const { data, error } = await supabase.rpc('get_dashboard_stats', { p_company_id: companyId });

  if (error) {
    console.error('[Dashboard] get_dashboard_stats failed:', error.message, error);
    throw new Error(error.message || 'Impossible de charger les statistiques du tableau de bord');
  }
  
  const stats = data as Record<string, unknown>;
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

const BACKUP_TABLE_COLUMNS: Record<string, string> = {
  products: PRODUCT_EXPORT_COLUMNS,
  product_groups: PRODUCT_GROUP_EXPORT_COLUMNS,
};

// Helper to fetch ALL rows from a table (handles Supabase 1000-row limit)
const fetchAllRows = async (tableName: string, scopeCompanyId?: string | null): Promise<any[]> => {
  const allRows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const companyScoped = scopeCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName);
  const selectColumns = BACKUP_TABLE_COLUMNS[tableName] ?? '*';

  while (hasMore) {
    let query = supabase
      .from(tableName as any)
      .select(selectColumns)
      .order('id')
      .range(from, from + pageSize - 1);

    if (companyScoped) {
      query = query.eq('company_id', scopeCompanyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      throw new Error(`Export ${tableName}: ${error.message}`);
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
const fetchAllRowsUuid = async (
  tableName: string,
  orderCol = 'created_at',
  scopeCompanyId?: string | null,
): Promise<any[]> => {
  const allRows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const companyScoped = scopeCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName);

  while (hasMore) {
    let query = supabase
      .from(tableName as any)
      .select('*')
      .order(orderCol)
      .range(from, from + pageSize - 1);

    if (companyScoped) {
      query = query.eq('company_id', scopeCompanyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      throw new Error(`Export ${tableName}: ${error.message}`);
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

async function fetchBackupTableRows(
  tableName: string,
  mode: BackupFetchMode,
  scopeCompanyId?: string | null,
): Promise<any[]> {
  if (mode === 'serial_id') {
    return fetchAllRows(tableName, scopeCompanyId);
  }
  return fetchAllRowsUuid(tableName, 'created_at', scopeCompanyId);
}

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

// Export/Import Database - exports data as ZIP; storage files optional (high egress).
export type ExportDatabaseOptions = {
  /** When false (default), only JSON metadata is exported — no Storage downloads. */
  includeStorage?: boolean;
};

export const exportDatabase = async (
  onProgress?: (message: string) => void,
  options: ExportDatabaseOptions = {},
): Promise<Blob | null> => {
  const { includeStorage = false } = options;
  try {
    const { error: adminErr } = await supabase.rpc('require_admin_role');
    if (adminErr) {
      throw new Error('Export réservé aux administrateurs');
    }

    const exportCompanyId = requireActiveCompanyId();
    onProgress?.('Récupération des données principales...');
    
    const [
      products, transactions, clients, fournisseurs, documents,
      orders, product_groups, product_group_fournisseurs, devis,
      profiles, user_roles, user_presence, team_chat_messages
    ] = await Promise.all([
      fetchAllRows('products', exportCompanyId),
      fetchAllRows('transactions', exportCompanyId),
      fetchAllRows('clients', exportCompanyId),
      fetchAllRows('fournisseurs', exportCompanyId),
      fetchAllRows('documents', exportCompanyId),
      fetchAllRows('orders', exportCompanyId),
      fetchAllRows('product_groups', exportCompanyId),
      fetchAllRows('product_group_fournisseurs', exportCompanyId),
      fetchAllRows('devis', exportCompanyId),
      fetchAllRowsUuid('profiles', 'created_at'),
      fetchAllRowsUuid('user_roles', 'created_at'),
      fetchAllRowsUuid('user_presence', 'created_at'),
      fetchAllRowsUuid('team_chat_messages', 'created_at'),
    ]);

    onProgress?.('Récupération galerie, finance, RH, commercial...');
    const extendedPairs = await Promise.all(
      BACKUP_EXTENDED_TABLES.map(async ({ table, mode }) => {
        try {
          const rows = await fetchBackupTableRows(table, mode, exportCompanyId);
          return [table, rows] as const;
        } catch (err) {
          console.warn(`[backup] skip ${table}:`, err);
          return [table, []] as const;
        }
      }),
    );
    const extendedData = Object.fromEntries(extendedPairs);

    onProgress?.('Récupération des références images (chemins Storage)...');
    const imageRefs = await fetchProductImageRefsForBackup(exportCompanyId);
    const productImageById = new Map(imageRefs.products.map((p) => [p.id, p.image]));
    const groupImageById = new Map(imageRefs.groups.map((g) => [g.id, g.image]));

    const productsForExport = products.map((p) => ({
      ...p,
      image: productImageById.get(p.id) ?? null,
    }));
    const productGroupsForExport = product_groups.map((g) => ({
      ...g,
      image: groupImageById.get(g.id) ?? null,
    }));

    const exportData = {
      _metadata: {
        version: BACKUP_FORMAT_VERSION,
        exportDate: new Date().toISOString(),
        application: 'Witnext',
        format: 'witnext-backup',
        includesStorage: includeStorage,
        tableCount:
          13 +
          extendedPairs.filter(([, rows]) => rows.length > 0).length,
      },
      data: {
        clients,
        fournisseurs,
        product_groups: productGroupsForExport,
        products: productsForExport,
        transactions,
        documents,
        orders,
        product_group_fournisseurs,
        devis,
        profiles,
        user_roles,
        user_presence,
        team_chat_messages,
        ...extendedData,
      }
    };

    const zip = new JSZip();
    zip.file('data.json', JSON.stringify(exportData, null, 2));

    // Build mapping: storage path → article (product group) name
    onProgress?.('Construction du mapping fichiers → articles...');
    
    const groupNameById = new Map<number, string>();
    for (const g of productGroupsForExport) {
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
    for (const p of productsForExport) {
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
    for (const g of productGroupsForExport) {
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

    // Download storage files only when explicitly requested (avoids multi-GB Supabase egress).
    if (includeStorage && allStoragePaths.length > 0) {
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
  const importCompanyId = getActiveCompanyIdForQuery();
  const failures: string[] = [];
  const TABLES_PRESERVE_USER_ID = new Set(['user_companies', 'user_section_permissions']);

  for (const item of items) {
    try {
      let insertData = { ...item };
      
      if (stripId) {
        delete (insertData as any).id;
      }

      if (importCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName)) {
        (insertData as any).company_id = importCompanyId;
      }
      
      delete (insertData as any).prix_ttc;

      if (tableName === 'products') {
        (insertData as any).quantity = 0;
      }
      
      if (currentUserId) {
        const originalUserId = (insertData as any).user_id;

        if (tableName === 'profiles' && originalUserId && originalUserId !== currentUserId) {
          console.log('Skipping non-current user profile to prevent auth violation');
          continue;
        }

        if (tableName === 'user_roles' && originalUserId && originalUserId !== currentUserId) {
          console.log('Skipping non-current user role to prevent auth violation');
          continue;
        }
        
        if ('created_by' in insertData) (insertData as any).created_by = currentUserId;
        if ('user_id' in insertData && !TABLES_PRESERVE_USER_ID.has(tableName)) {
          (insertData as any).user_id = currentUserId;
        }
        if ('updated_by' in insertData) (insertData as any).updated_by = currentUserId;
      }

      const conflict = BACKUP_UPSERT_CONFLICT[tableName];
      const upsertOptions = conflict ? { onConflict: conflict } : {};

      const { error } = await supabase
        .from(tableName as any)
        .upsert(insertData as any, upsertOptions);
      
      if (error) {
        failures.push(`${tableName}: ${error.code ?? 'error'} — ${error.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${tableName}: ${msg}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Import partiel (${failures.length} erreur(s)): ${failures.slice(0, 5).join('; ')}`);
  }
};

async function importStockTransactionsViaRpc(transactions: any[]): Promise<void> {
  if (!transactions.length) return;
  const failures: string[] = [];

  for (const tx of transactions) {
    const productId = tx.product_id;
    const quantity = Number(tx.quantity) || 0;
    const type = tx.type as string;
    if (!productId || quantity <= 0) continue;
    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) continue;

    const dateRaw = tx.date;
    const dateIso =
      typeof dateRaw === 'string' && dateRaw.length <= 10
        ? `${dateRaw}T12:00:00.000Z`
        : dateRaw || new Date().toISOString();

    const { error } = await supabase.rpc('create_stock_transaction', {
      p_product_id: productId,
      p_product_name: tx.product_name || 'Article',
      p_type: type,
      p_quantity: quantity,
      p_date: dateIso,
      p_note: tx.note ?? 'Import restauration',
    });

    if (error) {
      failures.push(`${productId}/${type}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Import mouvements stock (${failures.length} erreur(s)): ${failures.slice(0, 3).join('; ')}`
    );
  }
}

/** Opening stock when backup has product quantities but no transaction ledger rows. */
async function importOpeningStockFromProductSnapshot(products: any[]): Promise<void> {
  const failures: string[] = [];
  for (const p of products) {
    const qty = Number(p.quantity) || 0;
    const productId = p.id;
    if (!productId || qty <= 0) continue;

    const { error } = await supabase.rpc('create_stock_transaction', {
      p_product_id: productId,
      p_product_name: p.name || 'Article',
      p_type: 'IN',
      p_quantity: qty,
      p_date: new Date().toISOString(),
      p_note: 'Stock initial (import restauration)',
    });
    if (error) failures.push(`${productId}: ${error.message}`);
  }
  if (failures.length > 0) {
    throw new Error(
      `Stock initial import (${failures.length} erreur(s)): ${failures.slice(0, 3).join('; ')}`
    );
  }
}

async function importExtendedTables(
  dataToImport: Record<string, unknown>,
  onProgress?: (message: string) => void,
): Promise<void> {
  for (const tableName of BACKUP_EXTENDED_IMPORT_ORDER) {
    const rows = dataToImport[tableName];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    onProgress?.(`Import ${tableName} (${rows.length} ligne(s))...`);
    await insertTableData(tableName, rows as any[], false);
  }
}

export const importDatabase = async (file: Blob, onProgress?: (message: string) => void): Promise<void> => {
  try {
    const { error: adminErr } = await supabase.rpc('require_admin_role');
    if (adminErr) {
      throw new Error('Import réservé aux administrateurs');
    }

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
    } = dataToImport;

    onProgress?.('Suppression des données inventaire (admin)...');
    const restoreCompanyId = getActiveCompanyId();
    if (!restoreCompanyId) {
      throw new Error('Aucune société active sélectionnée pour la restauration');
    }
    const { error: clearError } = await supabase.rpc('restore_inventory_clear_tables', { p_company_id: restoreCompanyId });
    if (clearError) {
      throw new Error(clearError.message || 'Restauration refusée (droits administrateur requis)');
    }

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

    if (transactions.length > 0) {
      onProgress?.('Reconstruction du ledger stock (RPC)...');
      await importStockTransactionsViaRpc(transactions);
    } else if (products.some((p: { quantity?: number }) => Number(p.quantity) > 0)) {
      onProgress?.('Application du stock initial (RPC)...');
      await importOpeningStockFromProductSnapshot(products);
    }

    const backupVersion = Number(importData._metadata?.version ?? 5);
    if (backupVersion >= BACKUP_FORMAT_VERSION) {
      onProgress?.('Import modules étendus (galerie, finance, RH, commercial)...');
      await importExtendedTables(dataToImport, onProgress);
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
  const companyId = getActiveCompanyIdForQuery();
  if (!companyId) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id' as any, companyId)
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
  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS_LIGHT)
    .order('quantity', { ascending: true });

  const companyId = getActiveCompanyId();
  if (companyId) query = query.eq('company_id' as any, companyId);

  const { data, error } = await query;

  if (error) {
    console.error('Erreur lors de la récupération des produits en stock faible:', error);
    return [];
  }
  
  return data
    .filter(p => p.quantity <= p.min_stock)
    .map(p => mapProduct(p));
};

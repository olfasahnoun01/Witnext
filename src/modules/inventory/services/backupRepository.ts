import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId, getActiveCompanyIdForQuery, requireActiveCompanyId } from '@/lib/activeCompany';
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
import { fetchProductImageRefsForBackup } from '@/lib/productImageStorage';
import {
  importOpeningStockFromProductSnapshot,
  importStockTransactionsViaRpc,
} from '@/modules/inventory/services/stockRepository';

const BACKUP_TABLE_COLUMNS: Record<string, string> = {
  products: PRODUCT_EXPORT_COLUMNS,
  product_groups: PRODUCT_GROUP_EXPORT_COLUMNS,
};

async function fetchAllRows(tableName: string, scopeCompanyId?: string | null): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const companyScoped = scopeCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName);
  const selectColumns = BACKUP_TABLE_COLUMNS[tableName] ?? '*';

  while (hasMore) {
    let query = supabase
      .from(tableName as 'products')
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
      allRows.push(...(data as Record<string, unknown>[]));
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function fetchAllRowsUuid(
  tableName: string,
  orderCol = 'created_at',
  scopeCompanyId?: string | null
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const companyScoped = scopeCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName);

  while (hasMore) {
    let query = supabase
      .from(tableName as 'profiles')
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
      allRows.push(...(data as Record<string, unknown>[]));
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function fetchBackupTableRows(
  tableName: string,
  mode: BackupFetchMode,
  scopeCompanyId?: string | null
): Promise<Record<string, unknown>[]> {
  if (mode === 'serial_id') {
    return fetchAllRows(tableName, scopeCompanyId);
  }
  return fetchAllRowsUuid(tableName, 'created_at', scopeCompanyId);
}

async function listAllStorageFiles(bucket: string, prefix = ''): Promise<string[]> {
  const allPaths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return allPaths;

  for (const item of data) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      allPaths.push(fullPath);
    } else {
      const subFiles = await listAllStorageFiles(bucket, fullPath);
      allPaths.push(...subFiles);
    }
  }
  return allPaths;
}

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) return url.substring(idx + marker.length);
  return null;
}

function parseFicheUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim() || '_unnamed';
}

export type ExportDatabaseOptions = {
  includeStorage?: boolean;
};

export async function exportDatabase(
  onProgress?: (message: string) => void,
  options: ExportDatabaseOptions = {}
): Promise<Blob | null> {
  const { includeStorage = false } = options;
  try {
    const { error: adminErr } = await supabase.rpc('require_admin_role');
    if (adminErr) {
      throw new Error('Export réservé aux administrateurs');
    }

    const exportCompanyId = requireActiveCompanyId();
    onProgress?.('Récupération des données principales...');

    const [
      products,
      transactions,
      clients,
      fournisseurs,
      documents,
      orders,
      product_groups,
      product_group_fournisseurs,
      devis,
      profiles,
      user_roles,
      user_presence,
      team_chat_messages,
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
      })
    );
    const extendedData = Object.fromEntries(extendedPairs);

    onProgress?.('Récupération des références images (chemins Storage)...');
    const imageRefs = await fetchProductImageRefsForBackup(exportCompanyId);
    const productImageById = new Map(imageRefs.products.map((p) => [p.id, p.image]));
    const groupImageById = new Map(imageRefs.groups.map((g) => [g.id, g.image]));

    const productsForExport = products.map((p) => ({
      ...p,
      image: productImageById.get(p.id as number) ?? null,
    }));
    const productGroupsForExport = product_groups.map((g) => ({
      ...g,
      image: groupImageById.get(g.id as number) ?? null,
    }));

    const exportData = {
      _metadata: {
        version: BACKUP_FORMAT_VERSION,
        exportDate: new Date().toISOString(),
        application: 'Witnext',
        format: 'witnext-backup',
        includesStorage: includeStorage,
        tableCount: 13 + extendedPairs.filter(([, rows]) => rows.length > 0).length,
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
      },
    };

    const zip = new JSZip();
    zip.file('data.json', JSON.stringify(exportData, null, 2));

    onProgress?.('Construction du mapping fichiers → articles...');

    const groupNameById = new Map<number, string>();
    for (const g of productGroupsForExport) {
      groupNameById.set(g.id as number, g.name as string);
    }

    const pathToArticle = new Map<string, string>();
    const bucket = 'fiches-techniques';

    const mapUrlToArticle = (url: string, articleName: string) => {
      const path = extractStoragePath(url, bucket);
      if (path) pathToArticle.set(path, sanitizeFolderName(articleName));
    };

    for (const p of productsForExport) {
      const groupName = p.product_group_id ? groupNameById.get(p.product_group_id as number) : null;
      const articleName = groupName || (p.name as string);
      for (const url of parseFicheUrls(p.fiche_technique_url as string | null)) {
        mapUrlToArticle(url, articleName);
      }
      if (p.image) mapUrlToArticle(p.image as string, articleName);
    }

    for (const pgf of product_group_fournisseurs) {
      const groupName = groupNameById.get(pgf.product_group_id as number);
      if (groupName) {
        for (const url of parseFicheUrls(pgf.fiche_technique_url as string | null)) {
          mapUrlToArticle(url, groupName);
        }
      }
    }

    for (const g of productGroupsForExport) {
      if (g.image) mapUrlToArticle(g.image as string, g.name as string);
    }

    onProgress?.('Récupération de la liste des fichiers stockés...');
    let allStoragePaths: string[] = [];
    try {
      allStoragePaths = await listAllStorageFiles(bucket);
    } catch (err) {
      console.warn('Could not list storage files:', err);
    }

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
    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  } catch (error) {
    console.error("Erreur lors de l'export:", error);
    return null;
  }
}

async function insertTableData(
  tableName: string,
  items: Record<string, unknown>[],
  stripId = true
): Promise<void> {
  if (!items.length) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  const importCompanyId = getActiveCompanyIdForQuery();
  const failures: string[] = [];
  const TABLES_PRESERVE_USER_ID = new Set(['user_companies', 'user_section_permissions']);

  for (const item of items) {
    try {
      const insertData: Record<string, unknown> = { ...item };

      if (stripId) {
        delete insertData.id;
      }

      if (importCompanyId && BACKUP_COMPANY_SCOPED_TABLES.has(tableName)) {
        insertData.company_id = importCompanyId;
      }

      delete insertData.prix_ttc;

      if (tableName === 'products') {
        insertData.quantity = 0;
      }

      if (currentUserId) {
        const originalUserId = insertData.user_id;

        if (tableName === 'profiles' && originalUserId && originalUserId !== currentUserId) {
          continue;
        }

        if (tableName === 'user_roles' && originalUserId && originalUserId !== currentUserId) {
          continue;
        }

        if ('created_by' in insertData) insertData.created_by = currentUserId;
        if ('user_id' in insertData && !TABLES_PRESERVE_USER_ID.has(tableName)) {
          insertData.user_id = currentUserId;
        }
        if ('updated_by' in insertData) insertData.updated_by = currentUserId;
      }

      const conflict = BACKUP_UPSERT_CONFLICT[tableName];
      const upsertOptions = conflict ? { onConflict: conflict } : {};

      const { error } = await supabase
        .from(tableName as 'products')
        .upsert(insertData as never, upsertOptions);

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
}

async function importExtendedTables(
  dataToImport: Record<string, unknown>,
  onProgress?: (message: string) => void
): Promise<void> {
  for (const tableName of BACKUP_EXTENDED_IMPORT_ORDER) {
    const rows = dataToImport[tableName];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    onProgress?.(`Import ${tableName} (${rows.length} ligne(s))...`);
    await insertTableData(tableName, rows as Record<string, unknown>[], false);
  }
}

export async function importDatabase(
  file: Blob,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    const { error: adminErr } = await supabase.rpc('require_admin_role');
    if (adminErr) {
      throw new Error('Import réservé aux administrateurs');
    }

    let importData: Record<string, unknown>;
    let storageFiles: { name: string; data: Blob }[] = [];

    const arrayBuffer = await file.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    const isZip = header[0] === 0x50 && header[1] === 0x4b;

    if (isZip) {
      onProgress?.('Extraction du fichier ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataFile = zip.file('data.json');
      if (!dataFile) throw new Error('Fichier data.json manquant dans le ZIP');
      const jsonString = await dataFile.async('string');
      importData = JSON.parse(jsonString) as Record<string, unknown>;

      const fichesFolder = zip.folder('fiches-techniques');
      if (fichesFolder) {
        const filePromises: Promise<void>[] = [];
        fichesFolder.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            const fileName = relativePath.split('/').pop() || relativePath;
            filePromises.push(
              zipEntry.async('blob').then((blob) => {
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
      importData = JSON.parse(jsonString) as Record<string, unknown>;
    }

    let dataToImport: Record<string, unknown>;

    if (importData._metadata && importData.data) {
      dataToImport = importData.data as Record<string, unknown>;
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
        devis: importData.devis || [],
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
        devis: [],
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
    } = dataToImport as Record<string, unknown[]>;

    onProgress?.('Suppression des données inventaire (admin)...');
    const restoreCompanyId = getActiveCompanyId();
    if (!restoreCompanyId) {
      throw new Error('Aucune société active sélectionnée pour la restauration');
    }
    const { error: clearError } = await supabase.rpc('restore_inventory_clear_tables', {
      p_company_id: restoreCompanyId,
    });
    if (clearError) {
      throw new Error(clearError.message || 'Restauration refusée (droits administrateur requis)');
    }

    onProgress?.('Importation des clients...');
    await insertTableData('clients', clients as Record<string, unknown>[], false);

    onProgress?.('Importation des fournisseurs...');
    await insertTableData('fournisseurs', fournisseurs as Record<string, unknown>[], false);

    onProgress?.('Importation des documents...');
    await insertTableData('documents', documents as Record<string, unknown>[], false);

    onProgress?.('Importation des devis...');
    await insertTableData('devis', devis as Record<string, unknown>[], false);

    onProgress?.('Importation des commandes...');
    await insertTableData('orders', orders as Record<string, unknown>[], false);

    onProgress?.('Importation des groupes de produits...');
    await insertTableData('product_groups', product_groups as Record<string, unknown>[], false);

    onProgress?.('Importation des produits...');
    await insertTableData('products', products as Record<string, unknown>[], false);

    onProgress?.('Importation des fournisseurs de groupes...');
    await insertTableData(
      'product_group_fournisseurs',
      product_group_fournisseurs as Record<string, unknown>[],
      false
    );

    if (transactions.length > 0) {
      onProgress?.('Reconstruction du ledger stock (RPC)...');
      await importStockTransactionsViaRpc(transactions as Record<string, unknown>[]);
    } else if (
      (products as { quantity?: number }[]).some((p) => Number(p.quantity) > 0)
    ) {
      onProgress?.('Application du stock initial (RPC)...');
      await importOpeningStockFromProductSnapshot(products as Record<string, unknown>[]);
    }

    const backupVersion = Number(
      (importData._metadata as { version?: number } | undefined)?.version ?? 5
    );
    if (backupVersion >= BACKUP_FORMAT_VERSION) {
      onProgress?.('Import modules étendus (galerie, finance, RH, commercial)...');
      await importExtendedTables(dataToImport, onProgress);
    }

    if (storageFiles.length > 0) {
      onProgress?.(`Restauration de ${storageFiles.length} fichier(s)...`);

      const fileNameToPath = new Map<string, string>();
      const bucket = 'fiches-techniques';

      const registerUrl = (url: string) => {
        const path = extractStoragePath(url, bucket);
        if (path) {
          const fn = path.split('/').pop();
          if (fn) fileNameToPath.set(fn, path);
        }
      };

      for (const p of products as Record<string, unknown>[]) {
        for (const u of parseFicheUrls(p.fiche_technique_url as string | null)) registerUrl(u);
        if (p.image) registerUrl(p.image as string);
      }
      for (const pgf of product_group_fournisseurs as Record<string, unknown>[]) {
        for (const u of parseFicheUrls(pgf.fiche_technique_url as string | null)) registerUrl(u);
      }
      for (const g of product_groups as Record<string, unknown>[]) {
        if (g.image) registerUrl(g.image as string);
      }

      for (const sf of storageFiles) {
        try {
          const storagePath = fileNameToPath.get(sf.name) || `fiches/${sf.name}`;
          await supabase.storage.from(bucket).upload(storagePath, sf.data, { upsert: true });
        } catch (err) {
          console.warn(`Could not restore file ${sf.name}:`, err);
        }
      }
    }

    console.log('Base de données importée avec succès');
  } catch (error) {
    console.error("Erreur lors de l'import:", error);
    throw error;
  }
}

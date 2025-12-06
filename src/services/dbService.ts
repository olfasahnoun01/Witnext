import initSqlJs, { Database } from 'sql.js';
import { Product, Transaction, DashboardStats, CategoryValue } from '@/types';

let db: Database | null = null;

const DB_STORAGE_KEY = 'grosafe_inventory_db';

export const initDatabase = async (): Promise<void> => {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });

  // Try to load existing database from localStorage
  const savedDb = localStorage.getItem(DB_STORAGE_KEY);
  
  if (savedDb) {
    try {
      const binaryArray = Uint8Array.from(atob(savedDb), c => c.charCodeAt(0));
      db = new SQL.Database(binaryArray);
    } catch (error) {
      console.error('Erreur lors du chargement de la base de données:', error);
      db = new SQL.Database();
      createTables();
    }
  } else {
    db = new SQL.Database();
    createTables();
    insertSampleData();
  }
};

const createTables = (): void => {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      fournisseur TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')),
      quantity INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
};

const insertSampleData = (): void => {
  if (!db) return;

  const sampleProducts = [
    { name: 'Pantalon de Travail Pro', sku: 'PAN-001', category: 'Pantalons', fournisseur: 'Workwear Tunisia', size: '42', quantity: 45, price: 89.900, min_stock: 10 },
    { name: 'Blouson Sécurité Haute Visibilité', sku: 'BLO-002', category: 'Blousons', fournisseur: 'SafeEquip', size: 'L', quantity: 3, price: 145.000, min_stock: 5 },
    { name: 'Brodequin Sécurité S3', sku: 'BRD-003', category: 'Bordequin', fournisseur: 'BootMaster', size: '43', quantity: 0, price: 125.500, min_stock: 8 },
    { name: 'Gants de Protection', sku: 'GAN-004', category: 'Accessoires', fournisseur: 'ProGloves', size: 'M', quantity: 120, price: 15.900, min_stock: 20 },
    { name: 'Casque de Chantier', sku: 'CAS-005', category: 'Accessoires', fournisseur: 'SafeHead', size: 'Unique', quantity: 8, price: 35.000, min_stock: 10 },
    { name: 'Gilet Réfléchissant', sku: 'GIL-006', category: 'Blousons', fournisseur: 'VisioSafe', size: 'XL', quantity: 50, price: 22.500, min_stock: 15 },
  ];

  sampleProducts.forEach(product => {
    db!.run(
      `INSERT INTO products (name, sku, category, fournisseur, size, quantity, price, min_stock, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.name, product.sku, product.category, product.fournisseur, product.size, product.quantity, product.price, product.min_stock, null]
    );
  });

  // Add sample transactions
  const now = new Date().toISOString();
  const sampleTransactions = [
    { product_id: 1, product_name: 'Pantalon de Travail Pro', type: 'IN', quantity: 50, date: now, note: 'Réception commande initiale' },
    { product_id: 1, product_name: 'Pantalon de Travail Pro', type: 'OUT', quantity: 5, date: now, note: 'Vente client ABC' },
    { product_id: 4, product_name: 'Gants de Protection', type: 'IN', quantity: 150, date: now, note: 'Réapprovisionnement' },
    { product_id: 4, product_name: 'Gants de Protection', type: 'OUT', quantity: 30, date: now, note: 'Commande chantier' },
  ];

  sampleTransactions.forEach(tx => {
    db!.run(
      `INSERT INTO transactions (product_id, product_name, type, quantity, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
      [tx.product_id, tx.product_name, tx.type, tx.quantity, tx.date, tx.note]
    );
  });

  saveDatabase();
};

export const saveDatabase = (): void => {
  if (!db) return;
  
  const data = db.export();
  const base64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_STORAGE_KEY, base64);
};

// Products CRUD
export const getAllProducts = (): Product[] => {
  if (!db) return [];
  
  const results = db.exec('SELECT * FROM products ORDER BY name');
  if (results.length === 0) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const product: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      product[col] = row[i];
    });
    return product as unknown as Product;
  });
};

export const getProductById = (id: number): Product | null => {
  if (!db) return null;
  
  const results = db.exec('SELECT * FROM products WHERE id = ?', [id]);
  if (results.length === 0 || results[0].values.length === 0) return null;
  
  const columns = results[0].columns;
  const row = results[0].values[0];
  const product: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    product[col] = row[i];
  });
  return product as unknown as Product;
};

export const createProduct = (product: Omit<Product, 'id'>): number => {
  if (!db) return -1;
  
  db.run(
    `INSERT INTO products (name, sku, category, fournisseur, size, quantity, price, min_stock, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product.name, product.sku, product.category, product.fournisseur, product.size, product.quantity, product.price, product.min_stock, product.image]
  );
  
  const result = db.exec('SELECT last_insert_rowid()');
  const newId = result[0].values[0][0] as number;
  
  // Create initial transaction
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO transactions (product_id, product_name, type, quantity, date, note) VALUES (?, ?, 'IN', ?, ?, ?)`,
    [newId, product.name, product.quantity, now, 'Stock initial']
  );
  
  saveDatabase();
  return newId;
};

export const updateProduct = (id: number, product: Partial<Product>): void => {
  if (!db) return;
  
  const fields: string[] = [];
  const values: unknown[] = [];
  
  Object.entries(product).forEach(([key, value]) => {
    if (key !== 'id' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (fields.length === 0) return;
  
  values.push(id);
  db.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
};

export const deleteProduct = (id: number): void => {
  if (!db) return;
  
  db.run('DELETE FROM transactions WHERE product_id = ?', [id]);
  db.run('DELETE FROM products WHERE id = ?', [id]);
  saveDatabase();
};

// Transactions
export const getAllTransactions = (): Transaction[] => {
  if (!db) return [];
  
  const results = db.exec('SELECT * FROM transactions ORDER BY date DESC LIMIT 100');
  if (results.length === 0) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const tx: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      tx[col] = row[i];
    });
    return tx as unknown as Transaction;
  });
};

export const createTransaction = (tx: Omit<Transaction, 'id'>): void => {
  if (!db) return;
  
  // Update product quantity
  const product = getProductById(tx.product_id);
  if (!product) return;
  
  let newQuantity = product.quantity;
  if (tx.type === 'IN') {
    newQuantity += tx.quantity;
  } else if (tx.type === 'OUT') {
    newQuantity -= tx.quantity;
    if (newQuantity < 0) return; // Prevent negative stock
  } else {
    newQuantity = tx.quantity;
  }
  
  updateProduct(tx.product_id, { quantity: newQuantity });
  
  db.run(
    `INSERT INTO transactions (product_id, product_name, type, quantity, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
    [tx.product_id, tx.product_name, tx.type, tx.quantity, tx.date, tx.note]
  );
  
  saveDatabase();
};

// Dashboard Stats
export const getDashboardStats = (): DashboardStats => {
  if (!db) return { totalValue: 0, totalProducts: 0, lowStockCount: 0, outOfStockCount: 0, categoryValues: [] };
  
  const products = getAllProducts();
  
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

// Export/Import Database
export const exportDatabase = (): Uint8Array | null => {
  if (!db) return null;
  return db.export();
};

export const importDatabase = async (data: Uint8Array): Promise<void> => {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });
  
  db = new SQL.Database(data);
  saveDatabase();
};

export const getRecentTransactions = (limit: number = 10): Transaction[] => {
  if (!db) return [];
  
  const results = db.exec(`SELECT * FROM transactions ORDER BY date DESC LIMIT ${limit}`);
  if (results.length === 0) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const tx: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      tx[col] = row[i];
    });
    return tx as unknown as Transaction;
  });
};

export const getLowStockProducts = (): Product[] => {
  if (!db) return [];
  
  const results = db.exec('SELECT * FROM products WHERE quantity <= min_stock ORDER BY quantity ASC');
  if (results.length === 0) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const product: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      product[col] = row[i];
    });
    return product as unknown as Product;
  });
};

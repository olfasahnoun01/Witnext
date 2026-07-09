export { initDatabase, saveDatabase } from '@/modules/inventory/services/inventoryInit';
export {
  getAllProducts,
  getProductWithImage,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} from '@/modules/inventory/services/productRepository';
export {
  getAllTransactions,
  getRecentTransactions,
  createTransaction,
  createStockTransaction,
  applyProductQuantityChange,
} from '@/modules/inventory/services/stockRepository';
export { getDashboardStats } from '@/modules/inventory/services/dashboardRepository';
export {
  exportDatabase,
  importDatabase,
  type ExportDatabaseOptions,
} from '@/modules/inventory/services/backupRepository';

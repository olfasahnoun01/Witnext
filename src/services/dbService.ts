/**
 * @deprecated Import from `@/modules/inventory` instead.
 * Shim kept temporarily for backward compatibility.
 */
export {
  initDatabase,
  saveDatabase,
  getAllProducts,
  getProductWithImage,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getAllTransactions,
  getRecentTransactions,
  createTransaction,
  applyProductQuantityChange,
  getDashboardStats,
  exportDatabase,
  importDatabase,
  type ExportDatabaseOptions,
} from '@/modules/inventory';

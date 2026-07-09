import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@/types';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';

type TransactionRow = {
  id: number;
  product_id: number | null;
  product_name: string;
  type: string;
  quantity: number;
  date: string;
  note: string | null;
};

function mapTransaction(tx: TransactionRow): Transaction {
  return {
    id: tx.id,
    product_id: tx.product_id,
    product_name: tx.product_name,
    type: tx.type as Transaction['type'],
    quantity: tx.quantity,
    date: tx.date,
    note: tx.note || undefined,
  };
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const companyId = getActiveCompanyIdForQuery();
  if (!companyId) return [];

  const { data, error } = await filterByCompanyId(
    supabase.from('transactions').select('*').order('date', { ascending: false }).limit(100),
    companyId
  );

  if (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    return [];
  }

  return (data as TransactionRow[]).map(mapTransaction);
}

export async function getRecentTransactions(limit = 10): Promise<Transaction[]> {
  const companyId = getActiveCompanyIdForQuery();
  if (!companyId) return [];

  const { data, error } = await filterByCompanyId(
    supabase.from('transactions').select('*').order('date', { ascending: false }).limit(limit),
    companyId
  );

  if (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    return [];
  }

  return (data as TransactionRow[]).map(mapTransaction);
}

export async function createStockTransaction(
  tx: Omit<Transaction, 'id'>
): Promise<{ success: boolean; error?: string; transactionId?: number }> {
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
}

/** @deprecated Use createStockTransaction — kept for consumer compatibility. */
export const createTransaction = createStockTransaction;

export async function applyProductQuantityChange(
  productId: number,
  productName: string,
  fromQty: number,
  toQty: number
): Promise<{ success: boolean; error?: string }> {
  if (toQty === fromQty) return { success: true };
  const date = new Date().toISOString().slice(0, 10);
  if (toQty > fromQty) {
    return createStockTransaction({
      product_id: productId,
      product_name: productName,
      type: 'IN',
      quantity: toQty - fromQty,
      date,
    });
  }
  return createStockTransaction({
    product_id: productId,
    product_name: productName,
    type: 'OUT',
    quantity: fromQty - toQty,
    date,
  });
}

/** Import helper — replays stock ledger rows from backup. */
export async function importStockTransactionsViaRpc(transactions: Record<string, unknown>[]): Promise<void> {
  if (!transactions.length) return;
  const failures: string[] = [];

  for (const tx of transactions) {
    const productId = tx.product_id as number | undefined;
    const quantity = Number(tx.quantity) || 0;
    const type = tx.type as string;
    if (!productId || quantity <= 0) continue;
    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) continue;

    const dateRaw = tx.date;
    const dateIso =
      typeof dateRaw === 'string' && dateRaw.length <= 10
        ? `${dateRaw}T12:00:00.000Z`
        : (dateRaw as string) || new Date().toISOString();

    const { error } = await supabase.rpc('create_stock_transaction', {
      p_product_id: productId,
      p_product_name: (tx.product_name as string) || 'Article',
      p_type: type,
      p_quantity: quantity,
      p_date: dateIso,
      p_note: (tx.note as string | null) ?? 'Import restauration',
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

export async function importOpeningStockFromProductSnapshot(
  products: Record<string, unknown>[]
): Promise<void> {
  const failures: string[] = [];
  for (const p of products) {
    const qty = Number(p.quantity) || 0;
    const productId = p.id as number | undefined;
    if (!productId || qty <= 0) continue;

    const { error } = await supabase.rpc('create_stock_transaction', {
      p_product_id: productId,
      p_product_name: (p.name as string) || 'Article',
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

import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';

export async function findProductByBarcode(
  barcode: string,
  companyId: string
): Promise<Product | null> {
  const code = barcode.trim();
  if (!code) return null;

  const { data: byBarcode, error: e1 } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .eq('barcode', code)
    .limit(1)
    .maybeSingle();

  if (e1) throw e1;
  if (byBarcode) return byBarcode as Product;

  const { data: bySku, error: e2 } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .eq('sku', code)
    .limit(1)
    .maybeSingle();

  if (e2) throw e2;
  return (bySku as Product | null) ?? null;
}

export function generateBarcodeValue(sku: string, productId: number): string {
  const base = (sku || String(productId)).replace(/\s+/g, '').toUpperCase();
  if (/^\d{8,13}$/.test(base)) return base;
  return `WN${String(productId).padStart(8, '0')}`;
}

export async function updateProductBarcode(
  productId: number,
  barcode: string,
  companyId: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ barcode: barcode.trim() || null })
    .eq('id', productId)
    .eq('company_id', companyId);

  if (error) throw error;
}

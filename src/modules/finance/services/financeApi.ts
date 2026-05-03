import { supabase } from '@/integrations/supabase/client';
import type { FinanceCompanyRow } from '../types';
import type { InvoiceRow, PaymentRow } from '../types';

function formatSupabaseError(err: { message?: string; details?: string; hint?: string; code?: string }): string {
  const parts = [err.message, err.details, err.hint].filter(Boolean);
  const body = parts.join(' — ') || 'Erreur inconnue';
  return err.code ? `[${err.code}] ${body}` : body;
}

const STORAGE_KEY = 'finance_selected_company_id';

export function readStoredCompanyId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredCompanyId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchUserFinanceCompanies(): Promise<FinanceCompanyRow[]> {
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('finance_list_my_companies');
  if (!rpcErr && rpcRows != null && Array.isArray(rpcRows)) {
    return rpcRows as FinanceCompanyRow[];
  }

  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid) return [];

  const { data: links, error: e1 } = await supabase
    .from('user_companies')
    .select('company_id')
    .eq('user_id', uid);

  if (e1) {
    const wrapped = new Error(formatSupabaseError(e1));
    (wrapped as Error & { cause?: unknown }).cause = rpcErr ?? e1;
    throw wrapped;
  }

  const ids = [...new Set((links ?? []).map((r: { company_id: string }) => r.company_id))];
  if (ids.length === 0) return [];

  const { data: companies, error: e2 } = await supabase
    .from('companies')
    .select('id, code, name, created_at')
    .in('id', ids)
    .order('name');

  if (e2) {
    throw new Error(formatSupabaseError(e2));
  }
  return (companies ?? []) as FinanceCompanyRow[];
}

export async function listInvoices(companyId: string): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

export async function listPayments(companyId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('company_id', companyId)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PaymentRow[];
}

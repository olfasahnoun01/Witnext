import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats } from '@/types';
import { requireActiveCompanyId } from '@/lib/activeCompany';

export async function getDashboardStats(): Promise<DashboardStats> {
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
    categoryValues: ((stats.categoryValues as { category: string; value: number }[]) || []).map(
      (cv) => ({
        category: cv.category,
        value: Number(cv.value) || 0,
      })
    ),
  };
}

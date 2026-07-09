import { supabase } from '@/integrations/supabase/client';

export type MarketingLeadType = 'trial' | 'license';
export type MarketingLeadDeployment = 'web' | 'desktop' | 'both';

export interface SubmitMarketingLeadInput {
  type: MarketingLeadType;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  teamSize?: string;
  userCount?: number;
  deployment?: MarketingLeadDeployment;
  planCode?: string;
  modules?: string[];
  message?: string;
  sourcePath?: string;
  captchaToken?: string;
}

export interface MarketingLeadRecord {
  id: string;
  type: MarketingLeadType;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  team_size: string | null;
  user_count: number | null;
  deployment: MarketingLeadDeployment | null;
  plan_code: string | null;
  modules: string[];
  message: string | null;
  source_path: string | null;
  internal_notes: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function submitMarketingLead(input: SubmitMarketingLeadInput): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('submit-marketing-lead', {
    body: {
      type: input.type,
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      teamSize: input.teamSize,
      userCount: input.userCount,
      deployment: input.deployment,
      planCode: input.planCode,
      modules: input.modules,
      message: input.message,
      sourcePath: input.sourcePath,
      captchaToken: input.captchaToken,
    },
  });

  if (error) {
    throw new Error(error.message || 'Envoi impossible');
  }

  const payload = data as { success?: boolean; id?: string; error?: string };
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.success || !payload.id) {
    throw new Error('Réponse serveur invalide');
  }

  return { id: payload.id };
}

export async function fetchMarketingLeads(): Promise<MarketingLeadRecord[]> {
  const { data, error } = await supabase
    .from('marketing_leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingLeadRecord[];
}

export async function updateMarketingLead(
  id: string,
  patch: Partial<Pick<MarketingLeadRecord, 'status' | 'internal_notes' | 'handled_by'>>
): Promise<void> {
  const { error } = await supabase.from('marketing_leads').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

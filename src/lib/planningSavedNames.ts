import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

export type PlanningSavedNameKind = 'company' | 'site';

const LEGACY_COMPANIES_KEY = 'grosafe_companies';
const LEGACY_SITES_KEY = 'grosafe_sites';

function namesTable() {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(
    'planning_saved_names'
  );
}

function readLegacyNames(kind: PlanningSavedNameKind): string[] {
  try {
    const key = kind === 'company' ? LEGACY_COMPANIES_KEY : LEGACY_SITES_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => String(n).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function clearLegacyNames(): void {
  try {
    localStorage.removeItem(LEGACY_COMPANIES_KEY);
    localStorage.removeItem(LEGACY_SITES_KEY);
  } catch {
    // ignore
  }
}

async function migrateLegacyIfNeeded(companyId: string): Promise<void> {
  const legacyCompanies = readLegacyNames('company');
  const legacySites = readLegacyNames('site');
  if (legacyCompanies.length === 0 && legacySites.length === 0) return;

  const { count, error: countError } = await namesTable()
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (countError) {
    console.warn('[planning_saved_names] migrate count failed:', countError.message);
    return;
  }
  if ((count ?? 0) > 0) {
    clearLegacyNames();
    return;
  }

  const rows = [
    ...legacyCompanies.map((name) => ({ company_id: companyId, kind: 'company' as const, name })),
    ...legacySites.map((name) => ({ company_id: companyId, kind: 'site' as const, name })),
  ];
  if (rows.length === 0) {
    clearLegacyNames();
    return;
  }

  const { error } = await namesTable().upsert(rows, {
    onConflict: 'company_id,kind,name',
    ignoreDuplicates: true,
  });
  if (error) {
    console.warn('[planning_saved_names] migrate upsert failed:', error.message);
    return;
  }
  clearLegacyNames();
}

export async function loadPlanningSavedNames(
  companyId: string | null | undefined,
  kind: PlanningSavedNameKind
): Promise<string[]> {
  if (!companyId) return readLegacyNames(kind);
  await migrateLegacyIfNeeded(companyId);

  const { data, error } = await namesTable()
    .select('name')
    .eq('company_id', companyId)
    .eq('kind', kind)
    .order('name');

  if (error) {
    console.error('[planning_saved_names] load failed:', error.message);
    return readLegacyNames(kind);
  }
  return ((data as { name: string }[] | null) ?? []).map((r) => r.name);
}

export async function addPlanningSavedName(
  companyId: string | null | undefined,
  kind: PlanningSavedNameKind,
  name: string
): Promise<string[]> {
  const trimmed = name.trim();
  const cid = companyId ?? requireActiveCompanyId();
  if (!trimmed) return loadPlanningSavedNames(cid, kind);

  const { error } = await namesTable().upsert(
    { company_id: cid, kind, name: trimmed },
    { onConflict: 'company_id,kind,name', ignoreDuplicates: true }
  );
  if (error) throw error;

  clearLegacyNames();
  return loadPlanningSavedNames(cid, kind);
}

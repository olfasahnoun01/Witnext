import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import {
  classifyCommercialDoc,
  emptyCommercialDocCounts,
  incrementDocCount,
  type CommercialDocCounts,
  type CommercialDocKind,
} from '@/lib/commercialDocKind';

export interface CommercialTeamMember {
  userId: string;
  fullName: string;
  email: string | null;
}

export interface BossCommercialDocument {
  id: number;
  devisNumber: string;
  devisDate: string;
  createdAt: string;
  kind: CommercialDocKind;
  thirdPartyName: string | null;
  status: string;
  totalAmount: number | null;
  createdBy: string;
}

export interface BossEmployeeActivity {
  member: CommercialTeamMember;
  counts: CommercialDocCounts;
  documents: BossCommercialDocument[];
}

export interface BossDailyActivity {
  date: Date;
  employees: BossEmployeeActivity[];
  totalDocuments: number;
}

const COMMERCIAL_SECTION_KEYS = ['ventes', 'commercial'] as const;

function isCommercialPermission(sectionKey: string, subsectionKey: string | null | undefined): boolean {
  if (sectionKey === 'ventes') return true;
  if (sectionKey === 'commercial' && (!subsectionKey || subsectionKey === '')) return true;
  return false;
}

export async function loadCommercialTeam(companyId: string): Promise<CommercialTeamMember[]> {
  const [{ data: companyUsers, error: cuError }, { data: perms, error: permError }] =
    await Promise.all([
      supabaseQueryWithAuthRetry(() =>
        supabase.from('user_companies').select('user_id').eq('company_id', companyId)
      ),
      supabaseQueryWithAuthRetry(() =>
        supabase
          .from('user_section_permissions')
          .select('user_id, section_key, subsection_key')
          .in('section_key', [...COMMERCIAL_SECTION_KEYS])
      ),
    ]);

  if (cuError) throw cuError;
  if (permError) throw permError;

  const companyUserIds = new Set((companyUsers ?? []).map((r) => r.user_id));
  const commercialUserIds = new Set<string>();

  for (const row of perms ?? []) {
    if (!companyUserIds.has(row.user_id)) continue;
    if (isCommercialPermission(row.section_key, row.subsection_key)) {
      commercialUserIds.add(row.user_id);
    }
  }

  if (commercialUserIds.size === 0) return [];

  const ids = [...commercialUserIds];
  const { data: profiles, error: profileError } = await supabaseQueryWithAuthRetry(() =>
    supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids)
  );
  if (profileError) throw profileError;

  return (profiles ?? [])
    .map((p) => ({
      userId: p.user_id,
      fullName: resolveAccountDisplayName(p.full_name, p.email),
      email: p.email,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' }));
}

function resolveAccountDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail.split('@')[0] ?? mail;
  return 'Compte sans nom';
}

async function loadProfileNames(userIds: string[]): Promise<Map<string, CommercialTeamMember>> {
  if (userIds.length === 0) return new Map();

  const { data: profiles, error } = await supabaseQueryWithAuthRetry(() =>
    supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
  );
  if (error) throw error;

  const map = new Map<string, CommercialTeamMember>();
  for (const p of profiles ?? []) {
    map.set(p.user_id, {
      userId: p.user_id,
      fullName: resolveAccountDisplayName(p.full_name, p.email),
      email: p.email,
    });
  }
  return map;
}

export async function loadBossDailyActivity(
  companyId: string,
  date: Date
): Promise<BossDailyActivity> {
  const team = await loadCommercialTeam(companyId);
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const { data: rows, error } = await supabaseQueryWithAuthRetry(() =>
    supabase
      .from('devis')
      .select(
        'id, devis_number, devis_date, created_at, type, is_bc, is_bl, is_ba, third_party_name, status, total_amount, created_by'
      )
      .eq('company_id' as never, companyId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: false })
  );

  if (error) throw error;

  const docsByUser = new Map<string, BossCommercialDocument[]>();

  for (const row of rows ?? []) {
    const kind = classifyCommercialDoc(row);
    if (kind === 'OTHER') continue;
    const createdBy = row.created_by;
    if (!createdBy) continue;

    const doc: BossCommercialDocument = {
      id: row.id,
      devisNumber: row.devis_number,
      devisDate: row.devis_date,
      createdAt: row.created_at,
      kind,
      thirdPartyName: row.third_party_name,
      status: row.status,
      totalAmount: row.total_amount,
      createdBy,
    };

    const list = docsByUser.get(createdBy) ?? [];
    list.push(doc);
    docsByUser.set(createdBy, list);
  }

  const teamById = new Map(team.map((m) => [m.userId, m]));
  const orphanIds = [...docsByUser.keys()].filter((id) => !teamById.has(id));
  if (orphanIds.length > 0) {
    const orphanProfiles = await loadProfileNames(orphanIds);
    for (const [id, member] of orphanProfiles) {
      teamById.set(id, member);
    }
  }

  const allUserIds = new Set([...team.map((m) => m.userId), ...docsByUser.keys()]);

  const employees: BossEmployeeActivity[] = [...allUserIds].map((userId) => {
    const member = teamById.get(userId) ?? {
      userId,
      fullName: 'Compte inconnu',
      email: null,
    };
    const documents = docsByUser.get(userId) ?? [];
    let counts = emptyCommercialDocCounts();
    for (const doc of documents) {
      counts = incrementDocCount(counts, doc.kind);
    }
    return { member, counts, documents };
  });

  employees.sort((a, b) =>
    a.member.fullName.localeCompare(b.member.fullName, 'fr', { sensitivity: 'base' })
  );

  const totalDocuments = employees.reduce((sum, e) => sum + e.documents.length, 0);

  return { date, employees, totalDocuments };
}

export function formatBossActivityDate(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

export function formatBossDocTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

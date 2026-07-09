import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildProfilesMap, collectUserIdsForProfiles } from '@/lib/documentListAudit';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import { parseDevisRow } from '@/modules/commercial/quotations/lib/parseDevisRow';
import {
  ensureSupabaseSessionReady,
  isAuthSessionError,
  isJwtExpiredError,
  SESSION_EXPIRED_USER_MESSAGE,
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';
import { notifySessionInvalid } from '@/lib/sessionResume';
import { debugLog } from '@/lib/debugLog';
import type { Devis } from '@/types';

export function useDevisDocumentList() {
  const [allDevis, setAllDevis] = useState<Devis[]>([]);

  const loadAll = useCallback(async () => {
    const ready = await ensureSupabaseSessionReady();
    debugLog('useDevisDocumentList:loadAll', 'session ready check', { ready }, 'B');
    if (!ready) {
      notifySessionInvalid('Session expirée lors du chargement des devis');
      toast.error(SESSION_EXPIRED_USER_MESSAGE);
      return;
    }

    const activeCompanyId = getActiveCompanyId();
    const { data, error } = await supabaseQueryWithAuthRetry(async () => {
      let q = supabase.from('devis').select('*');
      if (activeCompanyId) q = filterByCompanyId(q, activeCompanyId);
      return q.order('created_at', { ascending: false }).limit(1000);
    });

    if (error) {
      debugLog('useDevisDocumentList:loadAll', 'devis query error', {
        isJwt: isJwtExpiredError(error.message),
        isAuth: isAuthSessionError(error.message),
        errorMsg: error.message?.slice(0, 80),
      }, 'E');
      toast.error(
        isJwtExpiredError(error.message) || isAuthSessionError(error.message)
          ? SESSION_EXPIRED_USER_MESSAGE
          : `Impossible de charger les documents : ${error.message}`
      );
      return;
    }

    debugLog('useDevisDocumentList:loadAll', 'devis query success', {
      rowCount: data?.length ?? 0,
    }, 'C');

    if (!data) return;

    const dataArr = data as Record<string, unknown>[];
    const userIds = collectUserIdsForProfiles(dataArr);
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseQueryWithAuthRetry(async () =>
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
      );
      if (profilesError) {
        console.warn('[useDevisDocumentList] profiles load failed:', profilesError.message);
      } else if (profiles) {
        profilesMap = buildProfilesMap(profiles as Record<string, unknown>[]);
      }
    }

    const sourceIds = [
      ...new Set(
        dataArr.flatMap((d) => {
          const ids: number[] = [];
          if (d.source_devis_id) ids.push(d.source_devis_id as number);
          const multi = d.source_devis_ids;
          if (Array.isArray(multi)) ids.push(...multi.filter((id) => typeof id === 'number'));
          return ids;
        })
      ),
    ] as number[];

    const sourceDevisMap: Record<number, string> = {};
    const sourceBcMap: Record<number, string> = {};
    if (sourceIds.length > 0) {
      dataArr.forEach((d) => {
        if (sourceIds.includes(d.id as number)) {
          sourceDevisMap[d.id as number] = d.devis_number as string;
        }
      });
    }
    dataArr.forEach((d) => {
      if (d.is_bc) {
        sourceBcMap[d.id as number] = d.devis_number as string;
      }
    });

    setAllDevis(dataArr.map((d) => parseDevisRow(d, profilesMap, sourceDevisMap, sourceBcMap)));
  }, []);

  return { allDevis, setAllDevis, loadAll };
}

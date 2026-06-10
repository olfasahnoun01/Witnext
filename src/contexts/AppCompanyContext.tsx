import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getActiveCompanyId, setActiveCompanyId, resolveActiveCompanyId } from '@/lib/activeCompany';
import { ensureSupabaseSessionReady, supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
export interface AppCompany {
  id: string;
  code: string;
  name: string;
}

interface AppCompanyContextValue {
  companies: AppCompany[];
  currentCompanyId: string | null;
  currentCompany: AppCompany | null;
  canSwitchCompany: boolean;
  loading: boolean;
  loadError: string | null;
  setCompany: (id: string) => void;
  reload: () => Promise<void>;
}

const AppCompanyContext = createContext<AppCompanyContextValue | null>(null);

/** Fires when the active company changes so module data loaders can refresh. */
export const COMPANY_CHANGED_EVENT = 'app:company-changed';

export function AppCompanyProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const sessionReady = !authLoading && !!userId && !!session?.access_token;
  const [companies, setCompanies] = useState<AppCompany[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(getActiveCompanyId());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedForUserRef = useRef<string | null>(null);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (!userId) {
      setCompanies([]);
      setCurrentCompanyId(null);
      setActiveCompanyId(null);
      setLoadError(null);
      setLoading(false);
      loadedForUserRef.current = null;
      return;
    }

    const hadCachedData = loadedForUserRef.current === userId;
    const background = opts?.background === true;

    if (!background) {
      setLoading(true);
      setLoadError(null);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const ready = await ensureSupabaseSessionReady(attempt === 0 ? 12_000 : 5000);
      if (!ready) {
        await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      const { data, error } = await supabaseQueryWithAuthRetry(() =>
        supabase.rpc('list_my_companies')
      );

      if (!error) {
        const rows = (data ?? []) as AppCompany[];
        setCompanies(rows);
        loadedForUserRef.current = userId;

        const next = resolveActiveCompanyId(rows, getActiveCompanyId());
        setCurrentCompanyId(next);
        setActiveCompanyId(next);
        setLoadError(rows.length === 0 ? 'Aucune société assignée à votre compte.' : null);
        setLoading(false);
        return;
      }

      console.warn(`[AppCompany] load attempt ${attempt + 1} failed:`, error.message);
      await new Promise((r) => window.setTimeout(r, 500 * (attempt + 1)));
    }

    console.error('[AppCompany] all load attempts failed');
    if (background && hadCachedData) {
      console.warn('[AppCompany] background reload failed — keeping cached companies');
      return;
    }
    setCompanies([]);
    setCurrentCompanyId(null);
    setActiveCompanyId(null);
    setLoadError('Impossible de charger vos sociétés. Réessayez ou reconnectez-vous.');
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!sessionReady) {
      if (!authLoading && !userId) {
        setCompanies([]);
        setCurrentCompanyId(null);
        setActiveCompanyId(null);
        setLoadError(null);
        setLoading(false);
        loadedForUserRef.current = null;
      }
      return;
    }
    void load();
  }, [sessionReady, authLoading, userId, load]);

  useSessionResumeReload(() => load({ background: true }));

  const setCompany = useCallback((id: string) => {
    setCurrentCompanyId(id);
    setActiveCompanyId(id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COMPANY_CHANGED_EVENT, { detail: { companyId: id } }));
    }
  }, []);

  const currentCompany = useMemo(
    () => companies.find((c) => c.id === currentCompanyId) ?? null,
    [companies, currentCompanyId]
  );

  const value = useMemo<AppCompanyContextValue>(
    () => ({
      companies,
      currentCompanyId,
      currentCompany,
      canSwitchCompany: companies.length > 1,
      loading,
      loadError,
      setCompany,
      reload: load,
    }),
    [companies, currentCompanyId, currentCompany, loading, loadError, setCompany, load]
  );

  return <AppCompanyContext.Provider value={value}>{children}</AppCompanyContext.Provider>;
}

export function useAppCompany(): AppCompanyContextValue {
  const ctx = useContext(AppCompanyContext);
  if (!ctx) {
    throw new Error('useAppCompany must be used within AppCompanyProvider');
  }
  return ctx;
}

/** Re-run a loader whenever the active company changes. */
export function useCompanyChangeReload(reload: () => void | Promise<void>) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    const handler = () => {
      void reloadRef.current();
    };
    window.addEventListener(COMPANY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(COMPANY_CHANGED_EVENT, handler);
  }, []);
}

/** True when company list is loaded and a valid active company is selected (if any exist). */
export function useCompanyReady(): boolean {
  const { loading, companies, currentCompanyId } = useAppCompany();
  if (loading) return false;
  if (companies.length === 0) return true;
  return currentCompanyId != null;
}

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
  setCompany: (id: string) => void;
  reload: () => Promise<void>;
}

const AppCompanyContext = createContext<AppCompanyContextValue | null>(null);

/** Fires when the active company changes so module data loaders can refresh. */
export const COMPANY_CHANGED_EVENT = 'app:company-changed';

export function AppCompanyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [companies, setCompanies] = useState<AppCompany[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(getActiveCompanyId());
  const [loading, setLoading] = useState(true);
  const initialisedRef = useRef(false);

  const load = useCallback(async () => {
    if (!session?.user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) throw new Error('Session non prête');

      const { data, error } = await supabaseQueryWithAuthRetry(() =>
        supabase.rpc('list_my_companies')
      );
      if (error) throw error;
      const rows = (data ?? []) as AppCompany[];
      setCompanies(rows);

          // Pick a valid current company: persisted choice if still allowed,
          // else Grosafe if present, else the first one.
          const next = resolveActiveCompanyId(rows, getActiveCompanyId());

          setCurrentCompanyId(next);
      setActiveCompanyId(next);
    } catch (err) {
      console.error('[AppCompany] failed to load companies:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
      initialisedRef.current = true;
    }
  }, [session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  useSessionResumeReload(load);

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
      setCompany,
      reload: load,
    }),
    [companies, currentCompanyId, currentCompany, loading, setCompany, load]
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

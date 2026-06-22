import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { FinanceCompanyPicker } from './components/FinanceCompanyPicker';
import { FinanceDashboard } from './components/FinanceDashboard';
import { FinanceCompanyProvider } from './context/FinanceCompanyContext';
import {
  canSwitchFinanceCompany,
  getUserPosteFromMetadata,
  isCompanyVerifiedThisSession,
  markCompanyVerified,
} from './lib/companyAccess';
import { getActiveCompanyId, setActiveCompanyId } from '@/lib/activeCompany';
import { fetchUserFinanceCompanies, readStoredCompanyId, writeStoredCompanyId } from './services/financeApi';
import type { FinanceCompanyRow } from './types';

type Phase = 'loading' | 'picker' | 'app';

/**
 * Module Finance multi-societes : selection societe + tableau de bord.
 * Admin / moderateur / responsable financier : code societe requis avant ouverture.
 */
export function FinanceModule() {
  const { user, isAdmin, isModerator, isLoading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [companies, setCompanies] = useState<FinanceCompanyRow[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [forcePicker, setForcePicker] = useState(false);

  const userPoste = useMemo(() => getUserPosteFromMetadata(user), [user]);
  const canSwitchCompany = useMemo(
    () => canSwitchFinanceCompany(isAdmin, isModerator, userPoste),
    [isAdmin, isModerator, userPoste]
  );

  const resolveInitialCompany = useCallback(
    (list: FinanceCompanyRow[]): { companyId: string | null; showPicker: boolean } => {
      if (list.length === 0) {
        return { companyId: null, showPicker: true };
      }

      if (!canSwitchCompany) {
        if (list.length === 1) {
          return { companyId: list[0].id, showPicker: false };
        }
        const appCompany = getActiveCompanyId();
        if (appCompany && list.some((c) => c.id === appCompany)) {
          return { companyId: appCompany, showPicker: false };
        }
        const stored = readStoredCompanyId();
        const validStored = stored && list.some((c) => c.id === stored);
        const id = validStored ? stored! : list[0].id;
        return { companyId: id, showPicker: false };
      }

      const appCompany = getActiveCompanyId();
      if (
        appCompany &&
        list.some((c) => c.id === appCompany) &&
        !forcePicker &&
        isCompanyVerifiedThisSession(appCompany)
      ) {
        return { companyId: appCompany, showPicker: false };
      }

      const stored = readStoredCompanyId();
      const validStored = stored && list.some((c) => c.id === stored);
      if (validStored && !forcePicker && isCompanyVerifiedThisSession(stored)) {
        return { companyId: stored, showPicker: false };
      }
      return { companyId: null, showPicker: true };
    },
    [canSwitchCompany, forcePicker]
  );

  const loadCompanies = useCallback(async () => {
    setPhase('loading');
    try {
      const list = await fetchUserFinanceCompanies();
      setCompanies(list);
      const { companyId: nextId, showPicker } = resolveInitialCompany(list);
      setCompanyId(nextId);
      if (nextId) {
        writeStoredCompanyId(nextId);
        setActiveCompanyId(nextId);
      }
      setPhase(showPicker ? 'picker' : 'app');
    } catch (e: unknown) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      toast.error('Impossible de charger vos societes Finance', {
        description: detail.length > 220 ? `${detail.slice(0, 220)}…` : detail,
        duration: 12_000,
      });
      setCompanies([]);
      setPhase('picker');
    }
  }, [resolveInitialCompany]);

  useEffect(() => {
    if (authLoading) return;
    void loadCompanies();
  }, [loadCompanies, authLoading]);

  const handleSelectCompany = useCallback(
    (c: FinanceCompanyRow) => {
      markCompanyVerified(c.id);
      setCompanyId(c.id);
      writeStoredCompanyId(c.id);
      setActiveCompanyId(c.id);
      setForcePicker(false);
      setPhase('app');
    },
    []
  );

  const handleRequestPicker = useCallback(() => {
    if (!canSwitchCompany) return;
    setForcePicker(true);
    setPhase('picker');
  }, [canSwitchCompany]);

  const handleCompanyIdChange = useCallback((id: string) => {
    setCompanyId(id);
    writeStoredCompanyId(id);
    setActiveCompanyId(id);
  }, []);

  if (authLoading || phase === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground text-sm">
        Chargement du module Finance...
      </div>
    );
  }

  if (phase === 'picker' || !companyId) {
    if (companies.length === 0) {
      return (
        <div className="max-w-lg mx-auto rounded-xl border bg-card p-8 text-center space-y-2">
          <h2 className="text-lg font-semibold">Aucune societe Finance</h2>
          <p className="text-sm text-muted-foreground">
            Votre compte n&apos;est rattache a aucune ligne dans <code>user_companies</code>. Un administrateur
            doit vous assigner une ou plusieurs societes.
          </p>
        </div>
      );
    }
    return (
      <FinanceCompanyPicker
        companies={companies}
        onSelect={handleSelectCompany}
        requireAccessCode={canSwitchCompany}
      />
    );
  }

  return (
    <FinanceCompanyProvider
      companies={companies}
      companyId={companyId}
      onCompanyIdChange={handleCompanyIdChange}
      onRequestPicker={handleRequestPicker}
      canSwitchCompany={canSwitchCompany}
    >
      <FinanceDashboard />
    </FinanceCompanyProvider>
  );
}

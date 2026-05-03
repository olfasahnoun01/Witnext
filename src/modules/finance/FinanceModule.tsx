import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FinanceCompanyPicker } from './components/FinanceCompanyPicker';
import { FinanceDashboard } from './components/FinanceDashboard';
import { FinanceCompanyProvider } from './context/FinanceCompanyContext';
import { fetchUserFinanceCompanies, readStoredCompanyId, writeStoredCompanyId } from './services/financeApi';
import type { FinanceCompanyRow } from './types';

type Phase = 'loading' | 'picker' | 'app';

/**
 * Module Finance multi-societes : selection societe + tableau de bord.
 * Ne modifie pas les ecrans Ventes / Achats historiques.
 */
export function FinanceModule() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [companies, setCompanies] = useState<FinanceCompanyRow[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [forcePicker, setForcePicker] = useState(false);

  const loadCompanies = useCallback(async () => {
    setPhase('loading');
    try {
      const list = await fetchUserFinanceCompanies();
      setCompanies(list);
      if (list.length === 0) {
        setCompanyId(null);
        setPhase('picker');
        return;
      }
      if (list.length === 1) {
        const id = list[0].id;
        setCompanyId(id);
        writeStoredCompanyId(id);
        setForcePicker(false);
        setPhase('app');
        return;
      }
      const stored = readStoredCompanyId();
      const validStored = stored && list.some((c) => c.id === stored);
      if (validStored && !forcePicker) {
        setCompanyId(stored);
        setPhase('app');
        return;
      }
      setPhase('picker');
    } catch (e: unknown) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      toast.error('Impossible de charger vos societes Finance', {
        description:
          detail.length > 220 ? `${detail.slice(0, 220)}…` : detail,
        duration: 12_000,
      });
      setCompanies([]);
      setPhase('picker');
    }
  }, [forcePicker]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const handleSelectCompany = useCallback((c: FinanceCompanyRow) => {
    setCompanyId(c.id);
    writeStoredCompanyId(c.id);
    setForcePicker(false);
    setPhase('app');
  }, []);

  const handleRequestPicker = useCallback(() => {
    setForcePicker(true);
    setPhase('picker');
  }, []);

  const handleCompanyIdChange = useCallback((id: string) => {
    setCompanyId(id);
    writeStoredCompanyId(id);
  }, []);

  if (phase === 'loading') {
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
    return <FinanceCompanyPicker companies={companies} onSelect={handleSelectCompany} />;
  }

  return (
    <FinanceCompanyProvider
      companies={companies}
      companyId={companyId}
      onCompanyIdChange={handleCompanyIdChange}
      onRequestPicker={handleRequestPicker}
    >
      <FinanceDashboard />
    </FinanceCompanyProvider>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { FluxDossierDetail, FluxListTab } from '../types/dossierTypes';
import { filterDossiersBySearch, filterDossiersByTab } from '../services/fluxResolver';
import { backfillDossiers, loadDossierDetails } from '../services/dossierRepository';

export function useFluxDossiers(companyId: string | null) {
  const [dossiers, setDossiers] = useState<FluxDossierDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FluxListTab>('en_cours');
  const [importing, setImporting] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId) {
      setDossiers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await loadDossierDetails(companyId);
      setDossiers(list);
    } catch (e) {
      toast.error('Impossible de charger les dossiers flux', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runBackfill = useCallback(async () => {
    if (!companyId) {
      toast.error('Aucune société active — impossible d\'importer les devis');
      return;
    }
    setImporting(true);
    try {
      const n = await backfillDossiers(companyId);
      toast.success(n > 0 ? `${n} dossier(s) créé(s) depuis les devis` : 'Aucun devis à importer');
      await reload();
    } catch (e) {
      toast.error('Import des dossiers échoué', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  }, [companyId, reload]);

  const filtered = filterDossiersBySearch(
    filterDossiersByTab(dossiers, tab),
    search
  );

  const counts = {
    en_cours: filterDossiersByTab(dossiers, 'en_cours').length,
    termines: filterDossiersByTab(dossiers, 'termines').length,
    incomplets: filterDossiersByTab(dossiers, 'incomplets').length,
  };

  return {
    dossiers: filtered,
    allDossiers: dossiers,
    loading,
    search,
    setSearch,
    tab,
    setTab,
    counts,
    reload,
    runBackfill,
    importing,
  };
}

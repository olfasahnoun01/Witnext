import { useCallback, useEffect, useState } from 'react';
import type { DossierEventRow, FluxDossierDetail } from '../types/dossierTypes';
import {
  fetchDossierCheckpoints,
  fetchDossierEvents,
  loadDossierDetails,
  syncDossierMetrics,
} from '../services/dossierRepository';

export function useFluxDossierDetail(companyId: string | null, dossierId: string | null) {
  const [detail, setDetail] = useState<FluxDossierDetail | null>(null);
  const [events, setEvents] = useState<DossierEventRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId || !dossierId) {
      setDetail(null);
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      await syncDossierMetrics(dossierId, companyId);
      const [all, evts, checkpoints] = await Promise.all([
        loadDossierDetails(companyId),
        fetchDossierEvents(dossierId),
        fetchDossierCheckpoints(dossierId),
      ]);
      const found = all.find((d) => d.id === dossierId) ?? null;
      if (found && checkpoints.length) {
        // detail already includes checkpoints from loadDossierDetails
      }
      setDetail(found);
      setEvents(evts);
    } finally {
      setLoading(false);
    }
  }, [companyId, dossierId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { detail, events, loading, reload };
}

import { useState } from 'react';
import { RefreshCw, Download, Play, LayoutDashboard, List } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { useFluxDossiers } from '../hooks/useFluxDossiers';
import { FluxSearchBar } from './FluxSearchBar';
import { FluxStatusTabs } from './FluxStatusTabs';
import { FluxDossierList } from './FluxDossierList';
import { FluxDashboard } from './FluxDashboard';
import { DossierDetailDrawer } from './DossierDetailDrawer';
import { StartFluxDialog } from './StartFluxDialog';
import { loadDossierDetails } from '../services/dossierRepository';
import type { FluxListTab } from '../types/dossierTypes';

type HubView = 'dashboard' | 'liste';

export function FluxSuiviHub() {
  const { currentCompanyId, loading: companyLoading } = useAppCompany();
  const companyId = currentCompanyId;
  const {
    dossiers,
    allDossiers,
    loading,
    search,
    setSearch,
    tab,
    setTab,
    counts,
    reload,
    runBackfill,
    importing,
  } = useFluxDossiers(companyId);

  const [view, setView] = useState<HubView>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  const handleFluxStarted = async (dossierId: string) => {
    await reload();
    if (companyId) {
      const list = await loadDossierDetails(companyId);
      if (list.some((d) => d.id === dossierId)) {
        setSelectedId(dossierId);
        return;
      }
    }
    setSelectedId(dossierId);
  };

  const handleBackfill = () => {
    if (!companyId) {
      toast.error('Sélectionnez une société avant d\'importer les devis');
      return;
    }
    void runBackfill();
  };

  const actionsDisabled = companyLoading || !companyId;

  const openDossier = (id: string) => {
    setSelectedId(id);
  };

  const goToList = (tab?: FluxListTab) => {
    if (tab) setTab(tab);
    setView('liste');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suivi des flux</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Devis → BC → achats → stock → livraison → facturation — tout le parcours en un seul endroit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setStartOpen(true)}
            disabled={actionsDisabled}
            title={actionsDisabled ? 'Société non chargée' : undefined}
          >
            <Play className="w-4 h-4 mr-1" /> Démarrer un flux
          </Button>
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={companyLoading}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBackfill}
            disabled={actionsDisabled || importing}
            title={actionsDisabled ? 'Sélectionnez une société' : 'Créer des dossiers depuis les devis / BC existants'}
          >
            <Download className="w-4 h-4 mr-1" />
            {importing ? 'Import…' : 'Importer devis existants'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            view === 'dashboard'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Tableau de bord
          {counts.incomplets > 0 && view !== 'dashboard' && (
            <span className="rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5 tabular-nums">
              {counts.incomplets}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView('liste')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            view === 'liste'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <List className="h-4 w-4" />
          Liste des dossiers
        </button>
      </div>

      {view === 'dashboard' ? (
        <FluxDashboard
          dossiers={allDossiers}
          loading={loading}
          onSelectDossier={openDossier}
          onGoToList={goToList}
        />
      ) : (
        <>
          <FluxSearchBar value={search} onChange={setSearch} />
          <FluxStatusTabs tab={tab} onTabChange={setTab} counts={counts} />

          <FluxDossierList
            dossiers={dossiers}
            loading={loading}
            selectedId={selectedId}
            onSelect={(d) => openDossier(d.id)}
            emptyMessage={
              search.trim()
                ? `Aucun dossier pour « ${search.trim()} ».`
                : undefined
            }
          />
        </>
      )}

      <DossierDetailDrawer
        dossierId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={() => void reload()}
      />

      {companyId && (
        <StartFluxDialog
          open={startOpen}
          onOpenChange={setStartOpen}
          companyId={companyId}
          onStarted={(id) => void handleFluxStarted(id)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  MapPin,
  Plus,
  Printer,
  Trash2,
  Users,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { getActiveCompanyId } from '@/lib/activeCompany';
import {
  DAY_KEYS,
  DAY_LABELS_AR,
  type DayKey,
  type DriverControlPlanningState,
  type DriverControlRow,
  emptyDriverRow,
  formatDateFr,
  getMondayIso,
  getSundayFromMondayIso,
} from '@/components/rh/driverControlPlanningTypes';
import './driverControlPlanningPrint.css';

const STORAGE_KEY = 'granisafe-driver-control-planning';
const DOCUMENT_CODE = 'FO-TEC-01';
const DEFAULT_SITE = 'SFAX';

function loadStored(): DriverControlPlanningState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DriverControlPlanningState;
  } catch {
    return null;
  }
}

function defaultState(): DriverControlPlanningState {
  const weekStart = getMondayIso();
  return {
    weekStart,
    site: DEFAULT_SITE,
    shiftGroup: 'النهار',
    drivers: [emptyDriverRow(), emptyDriverRow()],
  };
}

function renderDayCell(morning: string, evening: string) {
  const parts: { label: string; text: string }[] = [];
  if (morning.trim()) parts.push({ label: 'صباح', text: morning.trim() });
  if (evening.trim()) parts.push({ label: 'مساء', text: evening.trim() });
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((p) => (
        <div key={p.label} className="driver-control-sheet__cell-slot">
          <span className="driver-control-sheet__slot-label">{p.label}</span>{' '}
          {p.text}
        </div>
      ))}
    </>
  );
}

function PlanningSheet({
  weekStart,
  weekEnd,
  site,
  shiftGroup,
  drivers,
}: {
  weekStart: string;
  weekEnd: string;
  site: string;
  shiftGroup: string;
  drivers: DriverControlRow[];
}) {
  const rowCount = Math.max(drivers.length, 1);

  return (
    <div className="driver-control-sheet">
      <div className="driver-control-sheet__header">
        <div className="driver-control-sheet__logo">
          <img src="/gss-logo2.png" alt="GSS Granisafe" />
        </div>
        <div className="driver-control-sheet__title-wrap">
          <h1 className="driver-control-sheet__title">PLANNING DE CONTRÔLE DE JOUR</h1>
        </div>
        <div className="driver-control-sheet__code">Code : {DOCUMENT_CODE}</div>
      </div>

      <div className="driver-control-sheet__meta">
        <span>
          الفترة من : {formatDateFr(weekStart)} الى {formatDateFr(weekEnd)}
        </span>
        <span>الموقع المعني : {site || '—'}</span>
      </div>

      <table className="driver-control-sheet__table">
        <thead>
          <tr>
            <th className="col-name">الاسم واللقب</th>
            {DAY_KEYS.map((key) => (
              <th key={key} className="col-day">
                {DAY_LABELS_AR[key]}
              </th>
            ))}
            <th className="col-shift" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, index) => (
            <tr key={driver.id}>
              <td className="col-name">{driver.name || '—'}</td>
              {DAY_KEYS.map((key) => (
                <td key={key} className="col-day">
                  {renderDayCell(driver.days[key].morning, driver.days[key].evening)}
                </td>
              ))}
              {index === 0 ? (
                <td className="col-shift" rowSpan={rowCount}>
                  {shiftGroup}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DriverControlPlanning() {
  const { currentCompany, loading: companyLoading } = useAppCompany();
  const printRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DriverControlPlanningState>(() => loadStored() ?? defaultState());
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const isGranisafe = currentCompany?.code === 'granisafe';
  const weekEnd = useMemo(() => getSundayFromMondayIso(state.weekStart), [state.weekStart]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const updateDriver = useCallback((id: string, patch: Partial<DriverControlRow>) => {
    setState((prev) => ({
      ...prev,
      drivers: prev.drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const updateDay = useCallback(
    (driverId: string, day: DayKey, field: 'morning' | 'evening', value: string) => {
      setState((prev) => ({
        ...prev,
        drivers: prev.drivers.map((d) =>
          d.id === driverId
            ? { ...d, days: { ...d.days, [day]: { ...d.days[day], [field]: value } } }
            : d
        ),
      }));
    },
    []
  );

  const addDriver = () => {
    setState((prev) => ({ ...prev, drivers: [...prev.drivers, emptyDriverRow()] }));
  };

  const removeDriver = (id: string) => {
    setState((prev) => ({
      ...prev,
      drivers: prev.drivers.length <= 1 ? prev.drivers : prev.drivers.filter((d) => d.id !== id),
    }));
  };

  const resetPlanning = () => {
    setState(defaultState());
    toast.success('Planning réinitialisé');
  };

  const importChauffeurs = async () => {
    setLoadingDrivers(true);
    try {
      const cid = getActiveCompanyId();
      let q = supabase.from('employees').select('id, prenom, nom, role').order('nom');
      if (cid) q = q.eq('company_id' as never, cid);

      const { data, error } = await q;
      if (error) throw error;

      const chauffeurs = (data ?? []).filter((e) =>
        (e.role || '').toLowerCase().includes('chauffeur')
      );

      const rows = chauffeurs.map((e) => {
        const row = emptyDriverRow();
        row.name = `${(e.nom || '').trim()}+ ${(e.prenom || '').trim()}`.replace(/^\+\s*/, '').trim();
        if (!row.name) row.name = `${e.prenom || ''} ${e.nom || ''}`.trim();
        return row;
      });

      if (rows.length === 0) {
        toast.info('Aucun chauffeur trouvé — ajoutez des lignes manuellement.');
        return;
      }

      setState((prev) => ({ ...prev, drivers: rows }));
      toast.success(`${rows.length} chauffeur(s) importé(s)`);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger les chauffeurs');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handlePrint = () => {
    if (state.drivers.every((d) => !d.name.trim())) {
      toast.error('Ajoutez au moins un nom de chauffeur');
      return;
    }
    window.print();
  };

  if (companyLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isGranisafe) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
        <p className="text-lg font-medium text-foreground">Planning de contrôle — Granisafe</p>
        <p className="mt-2 text-sm">
          Cette fonctionnalité est disponible uniquement lorsque la société active est{' '}
          <strong>Granisafe</strong>. Changez de société via le sélecteur en haut de l&apos;écran.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Planning de contrôle de jour</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Semaine (lundi)
            </Label>
            <Input
              type="date"
              value={state.weekStart}
              onChange={(e) => setState((p) => ({ ...p, weekStart: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Période : {formatDateFr(state.weekStart)} → {formatDateFr(weekEnd)}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              الموقع المعني / Site
            </Label>
            <Input
              value={state.site}
              onChange={(e) => setState((p) => ({ ...p, site: e.target.value }))}
              placeholder="SFAX"
            />
          </div>
          <div className="space-y-2">
            <Label>Groupe horaire (colonne)</Label>
            <Input
              value={state.shiftGroup}
              onChange={(e) => setState((p) => ({ ...p, shiftGroup: e.target.value }))}
              placeholder="النهار"
              dir="rtl"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addDriver}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter chauffeur
          </Button>
          <Button type="button" variant="outline" onClick={() => void importChauffeurs()} disabled={loadingDrivers}>
            {loadingDrivers ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Importer chauffeurs
          </Button>
          <Button type="button" variant="outline" onClick={resetPlanning}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-muted/60">
                <th className="border border-border p-2 text-right w-36">الاسم واللقب</th>
                {DAY_KEYS.map((key) => (
                  <th key={key} className="border border-border p-2 text-center min-w-[120px]">
                    {DAY_LABELS_AR[key]}
                  </th>
                ))}
                <th className="border border-border p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {state.drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="border border-border p-1">
                    <Input
                      value={driver.name}
                      onChange={(e) => updateDriver(driver.id, { name: e.target.value })}
                      placeholder="NOM+ prénom"
                      className="h-8 text-xs"
                    />
                  </td>
                  {DAY_KEYS.map((key) => (
                    <td key={key} className="border border-border p-1 align-top">
                      <div className="space-y-1">
                        <Textarea
                          value={driver.days[key].morning}
                          onChange={(e) => updateDay(driver.id, key, 'morning', e.target.value)}
                          placeholder="صباح — ex: 05h00 releve aguereb"
                          rows={2}
                          className="text-xs min-h-[52px] resize-y"
                          dir="auto"
                        />
                        <Textarea
                          value={driver.days[key].evening}
                          onChange={(e) => updateDay(driver.id, key, 'evening', e.target.value)}
                          placeholder="مساء — ex: 17h00 route tunis"
                          rows={2}
                          className="text-xs min-h-[52px] resize-y"
                          dir="auto"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="border border-border p-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeDriver(driver.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={printRef} className="driver-control-print-root driver-control-print-root--screen-hidden" aria-hidden>
        <PlanningSheet
          weekStart={state.weekStart}
          weekEnd={weekEnd}
          site={state.site}
          shiftGroup={state.shiftGroup}
          drivers={state.drivers}
        />
      </div>
    </div>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Upload,
  Building2,
  MapPin,
  Loader2,
  Users,
  TrendingUp,
  UserPlus,
  UserMinus,
  FileJson,
  X,
  FileDown,
} from 'lucide-react';
import { downloadRhPlanningStatsPdf } from '@/utils/rhPlanningStatsPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  parsePlanningExportFile,
  snapshotMatchesFilter,
  compareAllConsecutive,
  type ParsedPlanningSnapshot,
  type PlanningPeriodComparison,
} from '@/lib/planningExport';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface UploadedPlanningFile {
  id: string;
  file: File;
}

function pct(n: number): string {
  return `${n.toFixed(1)} %`;
}

function fmtDelta(n: number, suffix = ''): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}${suffix}`;
}

export const RhStatistiques = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [uploads, setUploads] = useState<UploadedPlanningFile[]>([]);
  const [snapshots, setSnapshots] = useState<ParsedPlanningSnapshot[]>([]);
  const [comparisons, setComparisons] = useState<PlanningPeriodComparison[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const added: UploadedPlanningFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));
    setUploads((prev) => [...prev, ...added]);
    setAnalyzed(false);
    e.target.value = '';
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setAnalyzed(false);
  };

  const runAnalysis = useCallback(async () => {
    if (!companyName.trim() || !siteName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Société et site requis',
        description: 'Saisissez la société et le site pour filtrer les plannings comparés.',
      });
      return;
    }
    if (uploads.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Au moins 2 fichiers',
        description: 'Importez au minimum 2 exports JSON depuis la sous-section Planning.',
      });
      return;
    }

    setAnalyzing(true);
    try {
      const parsed: ParsedPlanningSnapshot[] = [];
      const skipped: string[] = [];

      for (const u of uploads) {
        const text = await u.file.text();
        const json = JSON.parse(text) as unknown;
        const snap = parsePlanningExportFile(json, u.file.name, u.id);

        if (!snapshotMatchesFilter(snap, companyName, siteName)) {
          skipped.push(
            `${u.file.name} (${snap.companyName || '?'} / ${snap.siteName || '?'})`
          );
          continue;
        }
        parsed.push(snap);
      }

      if (parsed.length < 2) {
        toast({
          variant: 'destructive',
          title: 'Fichiers non correspondants',
          description:
            skipped.length > 0
              ? `Seuls ${parsed.length} fichier(s) correspondent à « ${companyName} » / « ${siteName} ». Vérifiez les exports Planning.`
              : 'Aucun fichier ne correspond à la société et au site indiqués.',
        });
        setSnapshots([]);
        setComparisons([]);
        setAnalyzed(false);
        return;
      }

      if (skipped.length > 0) {
        toast({
          title: `${skipped.length} fichier(s) ignoré(s)`,
          description: 'Société ou site différents de votre sélection.',
        });
      }

      const comps = compareAllConsecutive(parsed);
      setSnapshots(parsed);
      setComparisons(comps);
      setAnalyzed(true);
      toast({ title: 'Analyse terminée', description: `${parsed.length} périodes comparées.` });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur d\'analyse',
        description: err instanceof Error ? err.message : 'JSON invalide',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [companyName, siteName, uploads, toast]);

  const evolutionChart = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate))
      .map((s) => ({
        label: s.periodLabel,
        agents: s.agents.length,
        tauxAffectation: Math.round(s.tauxAffectation * 10) / 10,
        assiduite: Math.round(s.attendanceRate * 10) / 10,
        joursTravailMoy: Math.round(s.avgWorkDaysPerAgent * 10) / 10,
      }));
  }, [snapshots]);

  const latestComparison = comparisons[comparisons.length - 1];

  const downloadPdf = useCallback(async () => {
    if (!analyzed || snapshots.length < 2) return;
    setExportingPdf(true);
    try {
      await downloadRhPlanningStatsPdf({
        companyName: companyName.trim(),
        siteName: siteName.trim(),
        snapshots,
        comparisons,
      });
      toast({
        title: 'PDF téléchargé',
        description: 'Le rapport statistiques a été généré.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur PDF',
        description: err instanceof Error ? err.message : 'Génération impossible',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [analyzed, snapshots, comparisons, companyName, siteName, toast]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />
          Statistiques RH
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Comparez les exports JSON du Planning (2 périodes minimum) pour calculer effectifs,
          taux d&apos;affectation, assiduité et recrutement.
        </p>
      </div>

      <Tabs defaultValue="planning" className="w-full">
        <TabsList>
          <TabsTrigger value="planning">Planning (JSON)</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6 mt-4">
          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Société & site (filtre)
            </h3>
            <p className="text-xs text-muted-foreground">
              Doivent correspondre aux champs « société » et « site » enregistrés dans chaque export
              Planning.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Société</Label>
                <Input
                  placeholder="Ex. Nutrimix"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setAnalyzed(false);
                  }}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Site
                </Label>
                <Input
                  placeholder="Ex. Usine Sfax"
                  value={siteName}
                  onChange={(e) => {
                    setSiteName(e.target.value);
                    setAnalyzed(false);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Fichiers Planning (JSON)
            </h3>
            <p className="text-xs text-muted-foreground">
              Exportez depuis Planning → bouton JSON, puis importez ici au moins 2 fichiers pour la
              même société et le même site.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={onFilesSelected}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Ajouter des fichiers JSON
            </Button>
            {uploads.length > 0 && (
              <ul className="space-y-2">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>{u.file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUpload(u.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => void runAnalysis()} disabled={analyzing || uploads.length < 2}>
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Générer les statistiques
            </Button>
          </section>

          {analyzed && snapshots.length >= 2 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="font-semibold text-sm">Rapport prêt</p>
                  <p className="text-xs text-muted-foreground">
                    Téléchargez un PDF complet (synthèse, comparaisons, listes agents, méthodologie).
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void downloadPdf()}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  Télécharger le PDF
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {snapshots
                  .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate))
                  .map((s) => (
                    <div
                      key={s.fileId}
                      className="rounded-xl border border-border bg-card p-4 space-y-1"
                    >
                      <p className="text-xs font-medium text-primary truncate">{s.periodLabel}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.fileName}</p>
                      <div className="flex items-center gap-2 pt-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-2xl font-bold">{s.agents.length}</span>
                        <span className="text-xs text-muted-foreground">agents</span>
                      </div>
                      <p className="text-xs">
                        Affectation : <strong>{pct(s.tauxAffectation)}</strong>
                      </p>
                      <p className="text-xs">
                        Assiduité : <strong>{pct(s.attendanceRate)}</strong>
                      </p>
                    </div>
                  ))}
              </div>

              {latestComparison && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase">Taux d&apos;affectation</p>
                    <p className="text-lg font-semibold mt-1">
                      {pct(latestComparison.tauxAffectationFrom)} →{' '}
                      {pct(latestComparison.tauxAffectationTo)}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        latestComparison.tauxAffectationDelta >= 0
                          ? 'text-emerald-600'
                          : 'text-destructive'
                      }`}
                    >
                      {fmtDelta(latestComparison.tauxAffectationDelta, ' pts')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Part des agents ayant au moins un shift de travail (J, N, P…)
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase">Assiduité</p>
                    <p className="text-lg font-semibold mt-1">
                      {pct(latestComparison.attendanceFrom)} → {pct(latestComparison.attendanceTo)}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        latestComparison.attendanceDelta >= 0
                          ? 'text-emerald-600'
                          : 'text-destructive'
                      }`}
                    >
                      {fmtDelta(latestComparison.attendanceDelta, ' pts')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Jours travaillés / (travail + repos R) sur le planning
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5" /> Recrutement
                    </p>
                    <p className="text-3xl font-bold mt-1 text-primary">
                      {latestComparison.recrutement.length}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <UserMinus className="w-3.5 h-3.5" /> Départs :{' '}
                      <strong>{latestComparison.departs.length}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Effectifs : {latestComparison.agentsFrom} → {latestComparison.agentsTo} (
                      {fmtDelta(latestComparison.agentsDelta)})
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-card border border-border rounded-xl p-6 h-72">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Évolution des effectifs
                  </h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={evolutionChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="agents" fill="#1e3a5f" name="Agents planifiés" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card border border-border rounded-xl p-6 h-72">
                  <h3 className="font-semibold mb-4">Affectation & assiduité</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={evolutionChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="tauxAffectation"
                        stroke="#b91c1c"
                        name="Taux affectation %"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="assiduite"
                        stroke="#15803d"
                        name="Assiduité %"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {comparisons.map((c, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="font-semibold text-sm">
                      Comparaison : {c.fromLabel} → {c.toLabel}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {c.fromFile} → {c.toFile}
                    </p>
                  </div>
                  <div className="p-4 grid gap-4 lg:grid-cols-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Indicateur</TableHead>
                          <TableHead className="text-right">Valeur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Agents planifiés</TableCell>
                          <TableCell className="text-right">
                            {c.agentsFrom} → {c.agentsTo} ({fmtDelta(c.agentsDelta)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Taux d&apos;affectation</TableCell>
                          <TableCell className="text-right">
                            {pct(c.tauxAffectationFrom)} → {pct(c.tauxAffectationTo)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Assiduité</TableCell>
                          <TableCell className="text-right">
                            {pct(c.attendanceFrom)} → {pct(c.attendanceTo)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Stables (2 périodes)</TableCell>
                          <TableCell className="text-right">{c.stables.length}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5" /> Recrutement ({c.recrutement.length})
                      </p>
                      {c.recrutement.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun nouvel agent</p>
                      ) : (
                        <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                          {c.recrutement.map((a, i) => (
                            <li key={i} className="rounded bg-emerald-500/10 px-2 py-1">
                              {a.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                        <UserMinus className="w-3.5 h-3.5" /> Départs ({c.departs.length})
                      </p>
                      {c.departs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun départ</p>
                      ) : (
                        <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                          {c.departs.map((a, i) => (
                            <li key={i} className="rounded bg-destructive/10 px-2 py-1">
                              {a.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Agents</TableHead>
                      <TableHead className="text-right">Taux affectation</TableHead>
                      <TableHead className="text-right">Assiduité</TableHead>
                      <TableHead className="text-right">J. travail moy.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...snapshots]
                      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate))
                      .map((s) => (
                        <TableRow key={s.fileId}>
                          <TableCell>
                            <div className="font-medium">{s.periodLabel}</div>
                            <div className="text-[10px] text-muted-foreground">{s.fileName}</div>
                          </TableCell>
                          <TableCell className="text-right">{s.agents.length}</TableCell>
                          <TableCell className="text-right">{pct(s.tauxAffectation)}</TableCell>
                          <TableCell className="text-right">{pct(s.attendanceRate)}</TableCell>
                          <TableCell className="text-right">
                            {s.avgWorkDaysPerAgent.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

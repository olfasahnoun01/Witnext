import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileCode2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt } from '../../lib/money';
import {
  buildTejXml,
  downloadTejXmlFile,
  filterCertificatesForPeriod,
  isValidMatriculeFiscal,
  normalizeMatriculeFiscal,
  TEJ_OPERATION_CODES,
  type TejActeDepot,
} from '../../lib/tej';
import { updateCompanyTejDeclarant } from '../../services/financeApi';
import {
  loadWithholdingCertificates,
  updateWithholdingCertificateTejData,
} from '../../services/treasuryStorage';
import type { FinanceCompanyRow } from '../../types';
import type { WithholdingCertificate } from '../../types/financeDomain';
import type { CounterpartyOption } from '../../types/paymentTypes';

interface TejExportPanelProps {
  company: FinanceCompanyRow;
  counterparties: CounterpartyOption[];
  onCompanyTejUpdated?: (patch: {
    matricule_fiscal: string;
    categorie_contribuable: 'PM' | 'PP';
  }) => void;
}

function currentPeriod(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Export mensuel XML pour dépôt sur TEJ (tej.finances.gov.tn).
 */
export function TejExportPanel({ company, counterparties, onCompanyTejUpdated }: TejExportPanelProps) {
  const initial = currentPeriod();
  const [year, setYear] = useState(String(initial.year));
  const [month, setMonth] = useState(String(initial.month).padStart(2, '0'));
  const [acteDepot, setActeDepot] = useState<TejActeDepot>('0');
  const [declarantMf, setDeclarantMf] = useState(company.matricule_fiscal ?? '');
  const [categorie, setCategorie] = useState<'PM' | 'PP'>(
    company.categorie_contribuable === 'PP' ? 'PP' : 'PM'
  );
  const [certs, setCerts] = useState<WithholdingCertificate[]>([]);
  const [operationOverrides, setOperationOverrides] = useState<Record<string, string>>({});
  const [invoiceYearOverrides, setInvoiceYearOverrides] = useState<Record<string, string>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, 'PM' | 'PP'>>({});
  const [residentOverrides, setResidentOverrides] = useState<Record<string, '0' | '1'>>({});
  const [cnpcOverrides, setCnpcOverrides] = useState<Record<string, '0' | '1'>>({});
  const [pChargeOverrides, setPChargeOverrides] = useState<Record<string, '0' | '1'>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const yearNum = Number(year);
  const monthNum = Number(month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loadWithholdingCertificates(company.id);
      setCerts(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement des certificats impossible');
      setCerts([]);
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDeclarantMf(company.matricule_fiscal ?? '');
    setCategorie(company.categorie_contribuable === 'PP' ? 'PP' : 'PM');
  }, [company.id, company.matricule_fiscal, company.categorie_contribuable]);

  const periodCerts = useMemo(
    () => filterCertificatesForPeriod(certs, yearNum, monthNum),
    [certs, yearNum, monthNum]
  );

  const exportCerts = useMemo(
    () =>
      periodCerts.map((cert) => {
        const current = counterparties.find((p) => p.id === cert.counterpartyId);
        const stored = cert.beneficiaire;
        const beneficiaire = {
          categorieContribuable:
            categoryOverrides[cert.id] ?? stored?.categorieContribuable ?? current?.categorieContribuable ?? 'PM',
          resident: residentOverrides[cert.id] ?? stored?.resident ?? '1',
          adresse: stored?.adresse?.trim() || current?.adresse?.trim() || '',
          activite: stored?.activite ?? null,
          email: stored?.email?.trim() || current?.email?.trim() || '',
          tel: stored?.tel?.trim() || current?.tel?.trim() || '',
        };
        const operationCode = operationOverrides[cert.id];
        const invoiceYear = invoiceYearOverrides[cert.id];
        return {
          ...cert,
          beneficiaire,
          lignes: cert.lignes.map((line) => ({
            ...line,
            idTypeOperation: operationCode || line.idTypeOperation || '',
            anneeFacturation: invoiceYear || line.anneeFacturation || '',
            cnpc: cnpcOverrides[cert.id] ?? line.cnpc ?? '0',
            pCharge: pChargeOverrides[cert.id] ?? line.pCharge ?? '0',
          })),
        };
      }),
    [
      periodCerts,
      counterparties,
      operationOverrides,
      invoiceYearOverrides,
      categoryOverrides,
      residentOverrides,
      cnpcOverrides,
      pChargeOverrides,
    ]
  );

  const totalRs = useMemo(
    () => exportCerts.reduce((s, c) => s + Number(c.totalRetenue || 0), 0),
    [exportCerts]
  );

  const preview = useMemo(() => {
    const mf = normalizeMatriculeFiscal(declarantMf) ?? '';
    return buildTejXml({
      declarant: { matriculeFiscal: mf, categorieContribuable: categorie },
      year: yearNum,
      month: monthNum,
      acteDepot,
      certificates: exportCerts,
    });
  }, [declarantMf, categorie, yearNum, monthNum, acteDepot, exportCerts]);

  const handleExport = async () => {
    const mf = normalizeMatriculeFiscal(declarantMf);
    if (!mf || !isValidMatriculeFiscal(mf)) {
      toast.error('Matricule fiscal déclarant invalide (ex. 0001238L).');
      return;
    }
    if (!preview.ok) {
      const first = preview.issues.find((i) => i.level === 'error');
      toast.error(first?.message ?? 'Données TEJ incomplètes — corrigez les erreurs.');
      return;
    }

    setBusy(true);
    try {
      if (mf !== company.matricule_fiscal || categorie !== company.categorie_contribuable) {
        await updateCompanyTejDeclarant(company.id, {
          matriculeFiscal: mf,
          categorieContribuable: categorie,
        });
        onCompanyTejUpdated?.({
          matricule_fiscal: mf,
          categorie_contribuable: categorie,
        });
      }
      await Promise.all(exportCerts.map(updateWithholdingCertificateTejData));
      downloadTejXmlFile(preview.xml, preview.filename);
      const warnCount = preview.issues.filter((i) => i.level === 'warning').length;
      toast.success(`Fichier ${preview.filename} téléchargé`, {
        description:
          warnCount > 0
            ? `${warnCount} avertissement(s) — vérifiez sur TEJ avant validation.`
            : 'Prêt pour dépôt sur tej.finances.gov.tn',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export XML impossible');
    } finally {
      setBusy(false);
    }
  };

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode2 className="h-5 w-5" />
          Export TEJ (XML)
        </CardTitle>
        <CardDescription>
          Génère le fichier mensuel des certificats de retenue pour dépôt sur{' '}
          <span className="font-medium">tej.finances.gov.tn</span> (CCT-RS V2, UTF-8).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Année</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mois de paiement</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  return (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Acte de dépôt</Label>
            <Select value={acteDepot} onValueChange={(v) => setActeDepot(v as TejActeDepot)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 — Initiale</SelectItem>
                  <SelectItem value="1">1 — Rectificative (ajouts)</SelectItem>
              </SelectContent>
            </Select>
              {acteDepot === '1' && (
                <p className="text-xs text-muted-foreground">
                  Cet export ajoute des certificats. La modification et l'annulation ne sont pas incluses.
                </p>
              )}
          </div>
          <div className="space-y-2">
            <Label>Catégorie déclarant</Label>
            <Select value={categorie} onValueChange={(v) => setCategorie(v as 'PM' | 'PP')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PM">PM — Personne morale</SelectItem>
                <SelectItem value="PP">PP — Personne physique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Matricule fiscal déclarant ({company.name})</Label>
            <Input
              className="font-mono"
              placeholder="0001238L"
              value={declarantMf}
              onChange={(e) => setDeclarantMf(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">Format TEJ : 7 chiffres + lettre clé.</p>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualiser
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleExport()}
              disabled={busy || loading || periodCerts.length === 0}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger XML
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Bénéficiaire</TableHead>
                <TableHead>MF</TableHead>
                <TableHead>Date paiement</TableHead>
                <TableHead>Nature TEJ</TableHead>
                <TableHead>Année facture</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>CNPC</TableHead>
                <TableHead>Prise charge</TableHead>
                <TableHead>Résident</TableHead>
                <TableHead className="text-right">Retenue</TableHead>
                <TableHead className="text-right">Lignes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : periodCerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Aucun certificat PAYEUR avec retenue pour {month}/{year}.
                  </TableCell>
                </TableRow>
              ) : (
                exportCerts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.refCertif || c.id}</TableCell>
                    <TableCell>{c.counterpartyName}</TableCell>
                    <TableCell className="font-mono text-xs">{c.matriculeFiscal || '—'}</TableCell>
                    <TableCell>{c.paymentDate || '—'}</TableCell>
                    <TableCell className="min-w-[300px]">
                      <Select
                        value={operationOverrides[c.id] || c.lignes[0]?.idTypeOperation || ''}
                        onValueChange={(value) =>
                          setOperationOverrides((current) => ({ ...current, [c.id]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Nature obligatoire" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(TEJ_OPERATION_CODES).map((operation) => (
                            <SelectItem key={operation.code} value={operation.code}>
                              {operation.code} — {operation.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-[100px] font-mono"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="2026"
                        value={invoiceYearOverrides[c.id] ?? c.lignes[0]?.anneeFacturation ?? ''}
                        onChange={(event) =>
                          setInvoiceYearOverrides((current) => ({
                            ...current,
                            [c.id]: event.target.value.replace(/\D/g, '').slice(0, 4),
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.beneficiaire?.categorieContribuable ?? 'PM'}
                        onValueChange={(value) =>
                          setCategoryOverrides((current) => ({
                            ...current,
                            [c.id]: value as 'PM' | 'PP',
                          }))
                        }
                      >
                        <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PM">PM</SelectItem>
                          <SelectItem value="PP">PP</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.lignes[0]?.cnpc ?? '0'}
                        onValueChange={(value) =>
                          setCnpcOverrides((current) => ({
                            ...current,
                            [c.id]: value as '0' | '1',
                          }))
                        }
                      >
                        <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Non</SelectItem>
                          <SelectItem value="1">Oui</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.lignes[0]?.pCharge ?? '0'}
                        onValueChange={(value) =>
                          setPChargeOverrides((current) => ({
                            ...current,
                            [c.id]: value as '0' | '1',
                          }))
                        }
                      >
                        <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Non</SelectItem>
                          <SelectItem value="1">Oui</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.beneficiaire?.resident ?? '1'}
                        onValueChange={(value) =>
                          setResidentOverrides((current) => ({
                            ...current,
                            [c.id]: value as '0' | '1',
                          }))
                        }
                      >
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Oui</SelectItem>
                          <SelectItem value="0">Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMontantDt(c.totalRetenue)}
                    </TableCell>
                    <TableCell className="text-right">{c.lignes?.length ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <p className="tabular-nums font-medium">
            {periodCerts.length} certificat(s) — total RS {formatMontantDt(totalRs)}
          </p>
          <p className="text-muted-foreground font-mono text-xs">{preview.filename}</p>
        </div>

        {preview.issues.length > 0 && (
          <ul className="space-y-1 text-sm rounded-md border p-3 bg-muted/30">
            {preview.issues.map((issue, i) => (
              <li
                key={`${issue.message}-${i}`}
                className={issue.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}
              >
                {issue.level === 'error' ? 'Erreur' : 'Avertissement'} : {issue.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

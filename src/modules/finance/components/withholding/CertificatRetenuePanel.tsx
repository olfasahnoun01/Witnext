import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FISCAL_LABELS } from '../../lib/fiscalTerminology';
import { TAUX_RETENUE_SOURCE } from '../../lib/constants';
import { formatMontantDt } from '../../lib/money';
import { computeWithholdingLine } from '../../services/paymentService';
import type { CounterpartyOption } from '../../types/paymentTypes';
import { CounterpartyCombobox } from '../payments/CounterpartyCombobox';
import { toast } from 'sonner';

interface CertificatRetenuePanelProps {
  clients: CounterpartyOption[];
  fournisseurs: CounterpartyOption[];
  sampleInvoices?: Array<{ numero: string; montantHt: number }>;
}

type CertificatMode = 'PAYEUR' | 'BENEFICIAIRE';

type LineDraft = {
  id: string;
  numeroFacture: string;
  montantBrut: number;
  taux: number;
};

/**
 * Certificat de retenue à la source — assiette = montant brut HT.
 */
export function CertificatRetenuePanel({
  clients,
  fournisseurs,
  sampleInvoices = [],
}: CertificatRetenuePanelProps) {
  const [mode, setMode] = useState<CertificatMode>('PAYEUR');
  const [tiers, setTiers] = useState<CounterpartyOption | null>(null);
  const [lines, setLines] = useState<LineDraft[]>(
    sampleInvoices.length > 0
      ? sampleInvoices.map((inv, i) => ({
          id: `l-${i}`,
          numeroFacture: inv.numero,
          montantBrut: inv.montantHt,
          taux: 1,
        }))
      : [{ id: 'l-0', numeroFacture: '', montantBrut: 0, taux: 1 }]
  );

  const counterparties = mode === 'PAYEUR' ? fournisseurs : clients;

  const computedLines = useMemo(
    () =>
      lines
        .filter((l) => l.montantBrut > 0)
        .map((l) =>
          computeWithholdingLine({
            invoiceId: l.id,
            numeroFacture: l.numeroFacture || '—',
            montantBrut: l.montantBrut,
            taux: l.taux,
          })
        ),
    [lines]
  );

  const totalRetenue = useMemo(
    () => computedLines.reduce((s, l) => s + l.montantRetenue, 0),
    [computedLines]
  );

  const summaryByRate = useMemo(() => {
    const map = new Map<number, { taux: number; label: string; lines: typeof computedLines; total: number }>();
    for (const t of TAUX_RETENUE_SOURCE) {
      map.set(t.value, { taux: t.value, label: t.label, lines: [], total: 0 });
    }
    for (const line of computedLines) {
      const bucket = map.get(line.taux) ?? {
        taux: line.taux,
        label: `${line.taux} %`,
        lines: [],
        total: 0,
      };
      bucket.lines.push(line);
      bucket.total += line.montantRetenue;
      map.set(line.taux, bucket);
    }
    return [...map.values()].filter((b) => b.lines.length > 0);
  }, [computedLines]);

  const handleGeneratePdf = () => {
    if (!tiers) {
      toast.error('Sélectionnez un partenaire.');
      return;
    }
    if (computedLines.length === 0) {
      toast.error('Ajoutez au moins une ligne avec un montant brut HT.');
      return;
    }
    toast.info(
      `Génération PDF (${mode}) — ${tiers.raisonSociale} : retenue totale ${formatMontantDt(totalRetenue)}.`
    );
  };

  const panelTitle =
    mode === 'PAYEUR'
      ? FISCAL_LABELS.attestationsRetenueFournisseur
      : FISCAL_LABELS.attestationsRetenueClient;

  const panelDescription =
    mode === 'PAYEUR'
      ? `${FISCAL_LABELS.retenueSourceFournisseur} — ${FISCAL_LABELS.retenuesFournisseursAReverser}. Assiette = montant brut HT.`
      : `${FISCAL_LABELS.retenueSourceClient} — ${FISCAL_LABELS.retenuesClientsAEncaisser}. Assiette = montant brut HT.`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{panelTitle}</CardTitle>
          <CardDescription>{panelDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Label>Mode</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as CertificatMode)}
            >
              <ToggleGroupItem value="PAYEUR" aria-label="Payeur">
                {FISCAL_LABELS.retenueSourceFournisseur}
              </ToggleGroupItem>
              <ToggleGroupItem value="BENEFICIAIRE" aria-label="Beneficiaire">
                {FISCAL_LABELS.retenueSourceClient}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2 p-4 rounded-lg border bg-muted/20">
            <div className="space-y-2 md:col-span-2">
              <Label>Partenaire</Label>
              <CounterpartyCombobox options={counterparties} value={tiers} onChange={setTiers} />
            </div>
            {tiers && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Raison sociale</p>
                  <p className="font-medium">{tiers.raisonSociale}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Matricule fiscal</p>
                  <p className="font-mono">{tiers.matriculeFiscal || '—'}</p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead className="text-right">Montant brut HT</TableHead>
                  <TableHead className="text-right">Assiette</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead className="text-right">Retenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const calc =
                    line.montantBrut > 0
                      ? computeWithholdingLine({
                          invoiceId: line.id,
                          numeroFacture: line.numeroFacture,
                          montantBrut: line.montantBrut,
                          taux: line.taux,
                        })
                      : null;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <input
                          className="w-full bg-transparent border-b text-sm py-1"
                          placeholder="N° facture"
                          value={line.numeroFacture}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...line, numeroFacture: e.target.value };
                            setLines(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          className="w-full text-right tabular-nums bg-transparent border-b text-sm py-1"
                          inputMode="decimal"
                          value={line.montantBrut || ''}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(',', '.'));
                            const next = [...lines];
                            next[idx] = { ...line, montantBrut: Number.isFinite(n) ? n : 0 };
                            setLines(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {calc ? formatMontantDt(calc.assiette) : '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(line.taux)}
                          onValueChange={(v) => {
                            const next = [...lines];
                            next[idx] = { ...line, taux: Number(v) };
                            setLines(next);
                          }}
                        >
                          <SelectTrigger className="h-9 w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAUX_RETENUE_SOURCE.map((t) => (
                              <SelectItem key={t.value} value={String(t.value)}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {calc ? formatMontantDt(calc.montantRetenue) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {summaryByRate.length > 0 && (
            <div className="space-y-3">
              <Label>Synthèse par taux de retenue</Label>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {summaryByRate.map((col) => (
                  <Card key={col.taux} className="border-dashed">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-sm">{col.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1 text-sm">
                      {col.lines.map((l) => (
                        <div key={l.invoiceId} className="flex justify-between gap-2 tabular-nums">
                          <span className="truncate text-muted-foreground">{l.numeroFacture}</span>
                          <span>{formatMontantDt(l.montantRetenue)}</span>
                        </div>
                      ))}
                      <p className="pt-2 font-semibold tabular-nums border-t">
                        Total : {formatMontantDt(col.total)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-lg font-semibold tabular-nums">
              Total retenue : {formatMontantDt(totalRetenue)}
            </p>
            {mode === 'PAYEUR' && (
              <Button onClick={handleGeneratePdf} className="gap-2">
                <FileDown className="h-4 w-4" />
                Générer le certificat PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

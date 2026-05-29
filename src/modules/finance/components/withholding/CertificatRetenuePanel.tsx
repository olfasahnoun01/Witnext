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
import { TAUX_RETENUE_SOURCE, TIMBRE_FISCAL_DT } from '../../lib/constants';
import { formatMontantDt } from '../../lib/money';
import { computeWithholdingLine } from '../../services/paymentService';
import type { CounterpartyOption } from '../../types/paymentTypes';
import { CounterpartyCombobox } from '../payments/CounterpartyCombobox';
import { toast } from 'sonner';

interface CertificatRetenuePanelProps {
  clients: CounterpartyOption[];
  fournisseurs: CounterpartyOption[];
  /** Factures liées pour démo / pré-remplissage (numéro + TTC). */
  sampleInvoices?: Array<{ numero: string; montantTtc: number }>;
}

type CertificatMode = 'PAYEUR' | 'BENEFICIAIRE';

/**
 * Certificat de retenue à la source — calcul assiette (TTC − timbre 1,000 DT).
 */
export function CertificatRetenuePanel({
  clients,
  fournisseurs,
  sampleInvoices = [],
}: CertificatRetenuePanelProps) {
  const [mode, setMode] = useState<CertificatMode>('PAYEUR');
  const [tiers, setTiers] = useState<CounterpartyOption | null>(null);
  const [lines, setLines] = useState(
    sampleInvoices.length > 0
      ? sampleInvoices.map((inv, i) => ({
          id: `l-${i}`,
          numeroFacture: inv.numero,
          montantTtc: inv.montantTtc,
          taux: 1 as number,
        }))
      : [{ id: 'l-0', numeroFacture: '', montantTtc: 0, taux: 1 }]
  );

  const counterparties = mode === 'PAYEUR' ? fournisseurs : clients;

  const computedLines = useMemo(
    () =>
      lines
        .filter((l) => l.montantTtc > 0)
        .map((l) =>
          computeWithholdingLine({
            invoiceId: l.id,
            numeroFacture: l.numeroFacture || '—',
            montantTtc: l.montantTtc,
            taux: l.taux,
          })
        ),
    [lines]
  );

  const totalRetenue = useMemo(
    () => computedLines.reduce((s, l) => s + l.montantRetenue, 0),
    [computedLines]
  );

  const handleGeneratePdf = () => {
    if (!tiers) {
      toast.error('Sélectionnez un partenaire.');
      return;
    }
    if (computedLines.length === 0) {
      toast.error('Ajoutez au moins une ligne avec un montant TTC.');
      return;
    }
    toast.info(
      `Génération PDF (${mode}) — ${tiers.raisonSociale} : retenue totale ${formatMontantDt(totalRetenue)}. Branchez ici votre générateur PDF officiel.`
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Certificat de retenue à la source</CardTitle>
          <CardDescription>
            Assiette = Montant TTC − timbre fiscal ({formatMontantDt(TIMBRE_FISCAL_DT, { suffix: '' })}).
            Obligatoire si total brut ≥ 1 000,000 DT TTC.
          </CardDescription>
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
                Payeur (fournisseurs)
              </ToggleGroupItem>
              <ToggleGroupItem value="BENEFICIAIRE" aria-label="Beneficiaire">
                Bénéficiaire (clients)
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2 p-4 rounded-lg border bg-muted/20">
            <div className="space-y-2 md:col-span-2">
              <Label>Partenaire</Label>
              <CounterpartyCombobox
                options={counterparties}
                value={tiers}
                onChange={setTiers}
              />
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
                {tiers.adresse && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground">Adresse</p>
                    <p className="text-sm">{tiers.adresse}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="text-right">Assiette (TTC − timbre)</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead className="text-right">Retenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const calc =
                    line.montantTtc > 0
                      ? computeWithholdingLine({
                          invoiceId: line.id,
                          numeroFacture: line.numeroFacture,
                          montantTtc: line.montantTtc,
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
                          value={line.montantTtc || ''}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(',', '.'));
                            const next = [...lines];
                            next[idx] = { ...line, montantTtc: Number.isFinite(n) ? n : 0 };
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
                          <SelectTrigger className="h-9 w-[180px]">
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

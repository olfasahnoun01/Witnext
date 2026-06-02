import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileMinus, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TAUX_TVA_TUNISIE } from '../../lib/vatEngine';
import { formatMontantDt, parseMontantInput } from '../../lib/money';
import { computeAvoirLineTotals, computeAvoirTotals } from '../../services/financeService';
import { createAvoirFinancier, generateAvoirNumero, listAvoirs } from '../../services/avoirApi';
import type { CounterpartyOption } from '../../types/paymentTypes';
import type { AvoirFinancier, AvoirFinancierType, TauxTvaTunisie } from '../../types/financeDomain';
import { CounterpartyCombobox } from '../payments/CounterpartyCombobox';

interface AvoirFinancierPanelProps {
  companyId: string;
  clients: CounterpartyOption[];
  fournisseurs: CounterpartyOption[];
  onCreated?: () => void;
}

type LineDraft = { description: string; montantHt: string; tauxTva: TauxTvaTunisie };

const emptyLine = (): LineDraft => ({ description: '', montantHt: '', tauxTva: 19 });

/**
 * Avoir financier — note de crédit sans impact stock (vente / achat).
 */
export function AvoirFinancierPanel({
  companyId,
  clients,
  fournisseurs,
  onCreated,
}: AvoirFinancierPanelProps) {
  const [tab, setTab] = useState<AvoirFinancierType>('vente');
  const [counterparty, setCounterparty] = useState<CounterpartyOption | null>(null);
  const [numero, setNumero] = useState(() => generateAvoirNumero('vente'));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState<LineDraft[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tiers = tab === 'vente' ? clients : fournisseurs;
  const [existing, setExisting] = useState<AvoirFinancier[]>([]);

  useEffect(() => {
    let active = true;
    listAvoirs(companyId, tab)
      .then((rows) => {
        if (active) setExisting(rows);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Chargement des avoirs impossible'));
    return () => {
      active = false;
    };
  }, [companyId, tab, refreshKey]);

  const previewLignes = useMemo(() => {
    return lignes
      .filter((l) => l.description.trim() && parseMontantInput(l.montantHt) != null)
      .map((l, i) =>
        computeAvoirLineTotals({
          id: `p-${i}`,
          description: l.description,
          montantHt: parseMontantInput(l.montantHt)!,
          tauxTva: l.tauxTva,
          montantTva: 0,
          montantTtc: 0,
        })
      );
  }, [lignes]);

  const totals = computeAvoirTotals(previewLignes);

  const handleCreate = async (valider: boolean) => {
    if (!counterparty) {
      toast.error('Sélectionnez un tiers.');
      return;
    }
    if (previewLignes.length === 0) {
      toast.error('Ajoutez au moins une ligne valide.');
      return;
    }
    setBusy(true);
    try {
      await createAvoirFinancier({
        companyId,
        type: tab,
        numero,
        issueDate,
        counterpartyId: counterparty.id,
        counterpartyName: counterparty.raisonSociale,
        counterpartyTaxId: counterparty.matriculeFiscal,
        lignes: previewLignes.map((l) => ({
          description: l.description,
          montantHt: l.montantHt,
          tauxTva: l.tauxTva,
        })),
        valider,
      });
      toast.success(valider ? 'Avoir validé — crédit disponible en lettrage' : 'Avoir en brouillon');
      setNumero(generateAvoirNumero(tab));
      setLignes([emptyLine()]);
      setCounterparty(null);
      setRefreshKey((k) => k + 1);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as AvoirFinancierType);
          setNumero(generateAvoirNumero(v as AvoirFinancierType));
          setCounterparty(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="vente">Avoir client</TabsTrigger>
          <TabsTrigger value="achat">Avoir fournisseur</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileMinus className="h-5 w-5" />
                Nouvel avoir financier
              </CardTitle>
              <CardDescription>
                Crédit pur — sans mouvement de stock. Utilisable lors du lettrage des règlements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Tiers</Label>
                  <CounterpartyCombobox options={tiers} value={counterparty} onChange={setCounterparty} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Numéro avoir</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="font-mono" />
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-28">HT</TableHead>
                      <TableHead className="w-36">TVA</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                      <TableHead className="text-right">TTC</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((line, idx) => {
                      const ht = parseMontantInput(line.montantHt);
                      const calc =
                        ht != null && line.description.trim()
                          ? computeAvoirLineTotals({
                              id: `x`,
                              description: line.description,
                              montantHt: ht,
                              tauxTva: line.tauxTva,
                              montantTva: 0,
                              montantTtc: 0,
                            })
                          : null;
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={line.description}
                              onChange={(e) => {
                                const n = [...lignes];
                                n[idx] = { ...line, description: e.target.value };
                                setLignes(n);
                              }}
                              placeholder="Remise exceptionnelle…"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              value={line.montantHt}
                              onChange={(e) => {
                                const n = [...lignes];
                                n[idx] = { ...line, montantHt: e.target.value };
                                setLignes(n);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(line.tauxTva)}
                              onValueChange={(v) => {
                                const n = [...lignes];
                                n[idx] = { ...line, tauxTva: Number(v) as TauxTvaTunisie };
                                setLignes(n);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TAUX_TVA_TUNISIE.map((t) => (
                                  <SelectItem key={t.value} value={String(t.value)}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {calc ? formatMontantDt(calc.montantTva) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {calc ? formatMontantDt(calc.montantTtc) : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={lignes.length <= 1}
                              onClick={() => setLignes(lignes.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLignes([...lignes, emptyLine()])}>
                <Plus className="h-4 w-4 mr-1" />
                Ligne
              </Button>

              <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t">
                <p className="text-lg font-semibold tabular-nums">
                  Total TTC : {formatMontantDt(totals.totalTtc)}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => void handleCreate(false)}>
                    Brouillon
                  </Button>
                  <Button disabled={busy} onClick={() => void handleCreate(true)}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Valider l&apos;avoir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avoirs enregistrés</CardTitle>
            </CardHeader>
            <CardContent>
              {existing.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun avoir pour cette catégorie.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {existing.map((a) => (
                    <li key={a.id} className="flex justify-between gap-4 border-b pb-2">
                      <span>
                        <span className="font-mono">{a.numero}</span> — {a.counterpartyName}
                      </span>
                      <span className="tabular-nums">
                        Crédit : {formatMontantDt(a.creditRestant)} / {formatMontantDt(a.totalTtc)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

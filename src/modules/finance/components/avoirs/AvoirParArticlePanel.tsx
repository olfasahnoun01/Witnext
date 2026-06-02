import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, PackageMinus, Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { formatMontantDt } from '../../lib/money';
import { computeAvoirTotals } from '../../services/financeService';
import {
  createAvoirParArticle,
  generateAvoirArticleNumero,
  listAvoirsParArticle,
} from '../../services/avoirApi';
import type { CounterpartyOption } from '../../types/paymentTypes';
import type { AvoirFinancierType, AvoirParArticle, TauxTvaTunisie } from '../../types/financeDomain';
import type { InvoiceLineRow, InvoiceRow } from '../../types';
import { CounterpartyCombobox } from '../payments/CounterpartyCombobox';

interface AvoirParArticlePanelProps {
  companyId: string;
  invoiceType: AvoirFinancierType;
  invoices: InvoiceRow[];
  linesByInvoice: Record<string, InvoiceLineRow[]>;
  counterparties: CounterpartyOption[];
  onCreated?: () => void;
}

type LineSelection = {
  invoiceLineId: string;
  selected: boolean;
  quantity: number;
  maxQty: number;
  productCode: string | null;
  description: string;
  unitPriceHt: number;
  tauxTva: TauxTvaTunisie;
};

export function AvoirParArticlePanel({
  companyId,
  invoiceType,
  invoices,
  linesByInvoice,
  counterparties,
  onCreated,
}: AvoirParArticlePanelProps) {
  const [counterparty, setCounterparty] = useState<CounterpartyOption | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [numero, setNumero] = useState(() => generateAvoirArticleNumero(invoiceType));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lineSelections, setLineSelections] = useState<LineSelection[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const eligibleInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.invoice_type === invoiceType &&
          inv.status !== 'void' &&
          inv.status !== 'draft' &&
          (!counterparty ||
            String(inv.counterpart_name || '')
              .toLowerCase()
              .includes(counterparty.raisonSociale.toLowerCase()))
      ),
    [invoices, invoiceType, counterparty]
  );

  const selectedInvoice = eligibleInvoices.find((i) => i.id === invoiceId);

  const loadLinesForInvoice = (id: string) => {
    const lines = linesByInvoice[id] || [];
    setLineSelections(
      lines.map((l) => ({
        invoiceLineId: l.id,
        selected: false,
        quantity: Number(l.quantity),
        maxQty: Number(l.quantity),
        productCode: l.product_code,
        description: l.description,
        unitPriceHt: Number(l.unit_price_ht),
        tauxTva: l.vat_rate as TauxTvaTunisie,
      }))
    );
  };

  const previewLines = useMemo(() => {
    return lineSelections
      .filter((l) => l.selected && l.quantity > 0)
      .map((l, i) => {
        const montantHt = Math.round(l.quantity * l.unitPriceHt * 1000) / 1000;
        const montantTva = Math.round(montantHt * (l.tauxTva / 100) * 1000) / 1000;
        return {
          id: `p-${i}`,
          description: l.description,
          montantHt,
          tauxTva: l.tauxTva,
          montantTva,
          montantTtc: Math.round((montantHt + montantTva) * 1000) / 1000,
        };
      });
  }, [lineSelections]);

  const totals = computeAvoirTotals(previewLines);
  const [existing, setExisting] = useState<AvoirParArticle[]>([]);

  useEffect(() => {
    let active = true;
    listAvoirsParArticle(companyId, invoiceType)
      .then((rows) => {
        if (active) setExisting(rows);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Chargement des avoirs impossible'));
    return () => {
      active = false;
    };
  }, [companyId, invoiceType, refreshKey]);

  const handleCreate = async (valider: boolean) => {
    if (!counterparty || !selectedInvoice) {
      toast.error('Sélectionnez un tiers et une facture.');
      return;
    }
    const lignes = lineSelections.filter((l) => l.selected && l.quantity > 0);
    if (lignes.length === 0) {
      toast.error('Sélectionnez au moins une ligne.');
      return;
    }
    setBusy(true);
    try {
      await createAvoirParArticle({
        companyId,
        type: invoiceType,
        numero,
        issueDate,
        invoiceId: selectedInvoice.id,
        invoiceNumero: selectedInvoice.numero,
        counterpartyId: counterparty.id,
        counterpartyName: counterparty.raisonSociale,
        counterpartyTaxId: counterparty.matriculeFiscal,
        lignes: lignes.map((l) => ({
          invoiceLineId: l.invoiceLineId,
          productCode: l.productCode,
          description: l.description,
          quantity: l.quantity,
          unitPriceHt: l.unitPriceHt,
          tauxTva: l.tauxTva,
        })),
        valider,
      });
      toast.success(valider ? 'Avoir par article validé' : 'Avoir par article en brouillon');
      setNumero(generateAvoirArticleNumero(invoiceType));
      setInvoiceId('');
      setLineSelections([]);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5" />
            Avoir par article — {invoiceType === 'vente' ? 'client' : 'fournisseur'}
          </CardTitle>
          <CardDescription>
            Crédit sur lignes de facture (retour marchandise, quantité partielle).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Tiers</Label>
              <CounterpartyCombobox
                options={counterparties}
                value={counterparty}
                onChange={(c) => {
                  setCounterparty(c);
                  setInvoiceId('');
                  setLineSelections([]);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Facture source</Label>
              <Select
                value={invoiceId}
                onValueChange={(v) => {
                  setInvoiceId(v);
                  loadLinesForInvoice(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir facture" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.numero} — {formatMontantDt(Number(inv.total_ttc))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Numéro avoir</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="font-mono" />
            </div>
          </div>

          {lineSelections.length > 0 && (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Code</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Qté max</TableHead>
                    <TableHead>Qté avoir</TableHead>
                    <TableHead>PU HT</TableHead>
                    <TableHead>TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineSelections.map((line, idx) => (
                    <TableRow key={line.invoiceLineId}>
                      <TableCell>
                        <Checkbox
                          checked={line.selected}
                          onCheckedChange={(c) => {
                            const next = [...lineSelections];
                            next[idx] = { ...line, selected: c === true };
                            setLineSelections(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>{line.productCode || '—'}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>{line.maxQty.toFixed(3)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={line.maxQty}
                          step="0.001"
                          className="w-24"
                          value={line.quantity}
                          disabled={!line.selected}
                          onChange={(e) => {
                            const q = Math.min(line.maxQty, Math.max(0, Number(e.target.value) || 0));
                            const next = [...lineSelections];
                            next[idx] = { ...line, quantity: q };
                            setLineSelections(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{line.unitPriceHt.toFixed(3)}</TableCell>
                      <TableCell>{line.tauxTva} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {previewLines.length > 0 && (
            <p className="text-sm tabular-nums border rounded p-2">
              Total TTC avoir : <strong>{formatMontantDt(totals.totalTtc)}</strong>
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void handleCreate(false)}>
              Brouillon
            </Button>
            <Button disabled={busy} className="gap-1" onClick={() => void handleCreate(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Valider avoir
            </Button>
          </div>
        </CardContent>
      </Card>

      {existing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avoirs par article enregistrés</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>TTC</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existing.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.numero}</TableCell>
                    <TableCell>{a.issueDate}</TableCell>
                    <TableCell>{a.invoiceNumero}</TableCell>
                    <TableCell>{a.counterpartyName}</TableCell>
                    <TableCell className="tabular-nums">{formatMontantDt(a.totalTtc)}</TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

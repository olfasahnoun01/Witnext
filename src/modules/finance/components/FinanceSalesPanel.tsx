import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { InvoiceLineRow, InvoiceRow, InvoiceWriteInput, VatRate } from '../types';
import { Checkbox } from '@/components/ui/checkbox';
import { TIMBRE_FISCAL_FACTURE_DT } from '../lib/tunisiaFiscal';
import { formatMontantDt } from '../lib/money';
import { FinanceAmount } from './shared/FinanceAmount';
import {
  cancelSalesInvoice,
  computeInvoiceLine,
  computeInvoiceTotals,
  createSalesInvoice,
  deleteSalesInvoice,
  registerSalesPayment,
  updateSalesInvoice,
  validateSalesInvoice,
} from '../services/financeApi';
import { CounterpartyCombobox } from './payments/CounterpartyCombobox';
import { SourceDocumentPicker } from './sources/SourceDocumentPicker';
import type { CounterpartyOption } from '../types/paymentTypes';
import type { CommercialInvoiceDraft, FinanceSourceRef } from '../types/commercialBridge';
import { supabase } from '@/integrations/supabase/client';

type LineForm = InvoiceWriteInput['lines'][number];

const emptyLine = (): LineForm => ({
  description: '',
  quantity: 1,
  unit_price_ht: 0,
  vat_rate: 19,
  product_code: '',
  remise_percent: 0,
});

const emptyForm = (): Omit<InvoiceWriteInput, 'company_id'> => ({
  numero: '',
  counterpart_name: '',
  counterpart_tax_id: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  notes: '',
  apply_timbre_fiscal: true,
  lines: [emptyLine()],
});

export function FinanceSalesPanel({
  companyId,
  invoices,
  linesByInvoice,
  clients = [],
  onReload,
}: {
  companyId: string;
  invoices: InvoiceRow[];
  linesByInvoice: Record<string, InvoiceLineRow[]>;
  clients?: CounterpartyOption[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceRow['status']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetailsFor, setShowDetailsFor] = useState<InvoiceRow | null>(null);
  const [showPayFor, setShowPayFor] = useState<InvoiceRow | null>(null);
  const [form, setForm] = useState<Omit<InvoiceWriteInput, 'company_id'>>(emptyForm());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'transfer' | 'card' | 'other'>('transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CounterpartyOption | null>(null);
  const [pendingSourceRef, setPendingSourceRef] = useState<FinanceSourceRef | null>(null);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        inv.numero.toLowerCase().includes(q) ||
        String(inv.counterpart_name || '')
          .toLowerCase()
          .includes(q);
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchFrom = !dateFrom || inv.issue_date >= dateFrom;
      const matchTo = !dateTo || inv.issue_date <= dateTo;
      return matchQ && matchStatus && matchFrom && matchTo;
    });
  }, [invoices, search, statusFilter, dateFrom, dateTo]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSelectedClient(null);
    setPendingSourceRef(null);
    setShowForm(true);
  };

  const applyCommercialDraft = (draft: CommercialInvoiceDraft) => {
    setEditing(null);
    setForm({
      numero: draft.numero,
      counterpart_name: draft.counterpart_name,
      counterpart_tax_id: draft.counterpart_tax_id || '',
      issue_date: draft.issue_date,
      due_date: '',
      notes: draft.notes || '',
      apply_timbre_fiscal: draft.apply_timbre_fiscal,
      lines: draft.lines.length > 0 ? draft.lines : [emptyLine()],
    });
    setPendingSourceRef(draft.source_ref);
    const matchClient = clients.find(
      (c) =>
        c.raisonSociale.toLowerCase() === draft.counterpart_name.toLowerCase() ||
        (draft.counterpart_tax_id && c.matriculeFiscal === draft.counterpart_tax_id)
    );
    setSelectedClient(matchClient ?? null);
    setShowForm(true);
  };

  const openEdit = (inv: InvoiceRow) => {
    const lines = linesByInvoice[inv.id] || [];
    const meta = (inv.metadata || {}) as Record<string, unknown>;
    const lineRemises = (meta.line_remises as number[] | undefined) ?? [];
    setEditing(inv);
    setForm({
      numero: inv.numero,
      counterpart_name: inv.counterpart_name || '',
      counterpart_tax_id: inv.counterpart_tax_id || '',
      issue_date: inv.issue_date,
      due_date: inv.due_date || '',
      notes: inv.notes || '',
      apply_timbre_fiscal: !!(meta as Record<string, unknown>).apply_timbre_fiscal,
      lines:
        lines.length > 0
          ? lines.map((l, i) => ({
              product_code: l.product_code || '',
              description: l.description,
              quantity: Number(l.quantity),
              unit_price_ht: Number(l.unit_price_ht),
              vat_rate: Number(l.vat_rate) as VatRate,
              remise_percent: lineRemises[i] ?? 0,
            }))
          : [emptyLine()],
    });
    setShowForm(true);
  };

  const upsertInvoice = async () => {
    if (!form.numero.trim() || !form.counterpart_name.trim()) {
      toast.error('Numéro et client sont obligatoires.');
      return;
    }
    if (form.lines.some((l) => !l.description.trim() || l.quantity <= 0)) {
      toast.error('Chaque ligne doit avoir désignation et quantité > 0.');
      return;
    }
    setBusy(true);
    try {
      const payload: InvoiceWriteInput = {
        company_id: companyId,
        numero: form.numero.trim(),
        counterpart_name: form.counterpart_name.trim(),
        counterpart_tax_id: form.counterpart_tax_id?.trim() || null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        notes: form.notes?.trim() || null,
        apply_timbre_fiscal: !!form.apply_timbre_fiscal,
        lines: form.lines.map((l) => ({
          product_code: l.product_code?.trim() || null,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit_price_ht: Number(l.unit_price_ht),
          vat_rate: l.vat_rate,
        })),
      };
      let invoiceId: string;
      if (editing) {
        await updateSalesInvoice(editing.id, payload);
        invoiceId = editing.id;
        toast.success('Facture mise à jour');
      } else {
        invoiceId = await createSalesInvoice(payload);
        toast.success('Facture créée');
      }
      if (pendingSourceRef) {
        const { data: row } = await supabase.from('invoices').select('metadata').eq('id', invoiceId).single();
        const meta = ((row?.metadata || {}) as Record<string, unknown>) ?? {};
        await supabase
          .from('invoices')
          .update({ metadata: { ...meta, source_ref: pendingSourceRef } })
          .eq('id', invoiceId);
      }
      setShowForm(false);
      await onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setBusy(false);
    }
  };

  const doValidate = async (invoice: InvoiceRow) => {
    try {
      const lines = linesByInvoice[invoice.id] || [];
      await validateSalesInvoice(invoice, lines);
      toast.success('Facture validée et écriture comptable générée');
      await onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Validation impossible');
    }
  };

  const doDelete = async (invoice: InvoiceRow) => {
    if (!window.confirm(`Supprimer la facture ${invoice.numero} ?`)) return;
    try {
      await deleteSalesInvoice(invoice.id);
      toast.success('Facture supprimée');
      await onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  const doCancel = async (invoice: InvoiceRow) => {
    if (!window.confirm(`Annuler la facture ${invoice.numero} ?`)) return;
    try {
      await cancelSalesInvoice(invoice.id);
      toast.success('Facture annulée');
      await onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Annulation impossible');
    }
  };

  const doPay = async () => {
    if (!showPayFor) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    try {
      await registerSalesPayment({
        invoice: showPayFor,
        amount,
        method: paymentMethod,
        reference: paymentRef.trim() || undefined,
      });
      toast.success('Paiement enregistré');
      setShowPayFor(null);
      setPaymentAmount('');
      setPaymentRef('');
      await onReload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Paiement impossible');
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Ventes - Factures clients</CardTitle>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Rechercher N° / client" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="issued">Validée</SelectItem>
              <SelectItem value="partial">Partielle</SelectItem>
              <SelectItem value="paid">Payée</SelectItem>
              <SelectItem value="void">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button variant="outline" className="gap-1" onClick={() => setShowSourcePicker(true)}>
            <FileInput className="h-4 w-4" />
            Importer pièce
          </Button>
          <Button onClick={openCreate}>Nouvelle facture</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>HT</TableHead>
              <TableHead>TVA</TableHead>
              <TableHead>TTC</TableHead>
              <TableHead>Payé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.numero}</TableCell>
                <TableCell>{inv.issue_date}</TableCell>
                <TableCell>{inv.counterpart_name || '—'}</TableCell>
                <TableCell>{Number(inv.total_ht).toFixed(3)}</TableCell>
                <TableCell>{Number(inv.vat_amount).toFixed(3)}</TableCell>
                <TableCell><FinanceAmount amount={Number(inv.total_ttc)} kind="income" /></TableCell>
                <TableCell><FinanceAmount amount={Number(inv.amount_paid)} kind="income" /></TableCell>
                <TableCell>{inv.status}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setShowDetailsFor(inv)}>Détail</Button>
                    {inv.status === 'draft' && <Button size="sm" variant="outline" onClick={() => openEdit(inv)}>Modifier</Button>}
                    {inv.status === 'draft' && <Button size="sm" onClick={() => doValidate(inv)}>Valider</Button>}
                    {inv.status !== 'void' && inv.status !== 'paid' && (
                      <Button size="sm" variant="secondary" onClick={() => setShowPayFor(inv)}>Payer</Button>
                    )}
                    {inv.status === 'draft' && (
                      <Button size="sm" variant="destructive" onClick={() => doDelete(inv)}>Supprimer</Button>
                    )}
                    {(inv.status === 'draft' || inv.status === 'issued') && (
                      <Button size="sm" variant="outline" onClick={() => doCancel(inv)}>Annuler</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimer</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier facture vente' : 'Nouvelle facture vente'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label>N° facture</Label><Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} /></div>
            <div>
              <Label>Client (annuaire Ventes)</Label>
              <CounterpartyCombobox
                options={clients}
                value={selectedClient}
                placeholder="Sélectionner un client…"
                onChange={(c) => {
                  setSelectedClient(c);
                  if (c) {
                    setForm((f) => ({
                      ...f,
                      counterpart_name: c.raisonSociale,
                      counterpart_tax_id: c.matriculeFiscal || '',
                    }));
                  }
                }}
              />
            </div>
            <div><Label>MF client</Label><Input value={form.counterpart_tax_id || ''} onChange={(e) => setForm((f) => ({ ...f, counterpart_tax_id: e.target.value }))} /></div>
            <div className="md:col-span-2">
              <Label>Nom client (libre ou complément)</Label>
              <Input
                value={form.counterpart_name}
                onChange={(e) => setForm((f) => ({ ...f, counterpart_name: e.target.value }))}
              />
            </div>
            <div><Label>Date facture</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} /></div>
            <div><Label>Échéance</Label><Input type="date" value={form.due_date || ''} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                checked={!!form.apply_timbre_fiscal}
                onCheckedChange={(c) => setForm((f) => ({ ...f, apply_timbre_fiscal: c === true }))}
              />
              <Label>Timbre fiscal ({formatMontantDt(TIMBRE_FISCAL_FACTURE_DT)})</Label>
            </div>
            <div className="md:col-span-3"><Label>Notes</Label><Textarea value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Lignes facture</Label>
              <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>
                Ajouter ligne
              </Button>
            </div>
            {form.lines.map((line, idx) => {
              const lineCalc = computeInvoiceLine(line);
              return (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_90px_120px_90px_100px_100px_100px_80px] items-end">
                <div><Label>Code</Label><Input value={line.product_code || ''} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, product_code: e.target.value } : l)) }))} /></div>
                <div><Label>Désignation</Label><Input value={line.description} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)) }))} /></div>
                <div><Label>Qté</Label><Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) || 0 } : l)) }))} /></div>
                <div><Label>PU HT</Label><Input type="number" min="0" step="0.001" value={line.unit_price_ht} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, unit_price_ht: Number(e.target.value) || 0 } : l)) }))} /></div>
                <div><Label>Remise %</Label><Input type="number" min="0" max="100" step="0.1" value={line.remise_percent ?? 0} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, remise_percent: Number(e.target.value) || 0 } : l)) }))} /></div>
                <div><Label>Mt remise</Label><Input readOnly className="bg-muted tabular-nums" value={lineCalc.montant_remise.toFixed(3)} /></div>
                <div><Label>Net HT</Label><Input readOnly className="bg-muted tabular-nums" value={lineCalc.total_ht.toFixed(3)} /></div>
                <div>
                  <Label>TVA %</Label>
                  <Select value={String(line.vat_rate)} onValueChange={(v) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, vat_rate: Number(v) as VatRate } : l)) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19</SelectItem>
                      <SelectItem value="13">13</SelectItem>
                      <SelectItem value="7">7</SelectItem>
                      <SelectItem value="0">0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines }))}>Retirer</Button>
              </div>
            );})}
          </div>

          {(() => {
            const totals = computeInvoiceTotals(form.lines, { apply_timbre_fiscal: form.apply_timbre_fiscal });
            return (
              <div className="rounded border p-3 text-sm tabular-nums space-y-1">
                <p>
                  Brut HT <strong>{formatMontantDt(totals.brut_ht)}</strong> | Remise{' '}
                  <strong>{formatMontantDt(totals.montant_remise)}</strong> | Net HT{' '}
                  <strong>{formatMontantDt(totals.total_ht)}</strong>
                </p>
                <p>
                  TVA <strong>{formatMontantDt(totals.total_tva)}</strong> | TTC{' '}
                  <FinanceAmount amount={totals.total_ttc} kind="income" />
                  {totals.timbre_fiscal > 0 && ` (dont timbre ${formatMontantDt(totals.timbre_fiscal)})`}
                </p>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Fermer</Button>
            <Button onClick={upsertInvoice} disabled={busy}>{busy ? 'Sauvegarde...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetailsFor} onOpenChange={(o) => !o && setShowDetailsFor(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Détail facture</DialogTitle></DialogHeader>
          {showDetailsFor && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {showDetailsFor.numero} - {showDetailsFor.counterpart_name || '—'} - {showDetailsFor.issue_date}
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Désignation</TableHead><TableHead>Qté</TableHead><TableHead>PU HT</TableHead><TableHead>TVA%</TableHead><TableHead>TTC</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(linesByInvoice[showDetailsFor.id] || []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.product_code || '—'}</TableCell>
                      <TableCell>{l.description}</TableCell>
                      <TableCell>{Number(l.quantity).toFixed(3)}</TableCell>
                      <TableCell>{Number(l.unit_price_ht).toFixed(3)}</TableCell>
                      <TableCell>{l.vat_rate}</TableCell>
                      <TableCell><FinanceAmount amount={Number(l.total_ttc)} kind="income" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPayFor} onOpenChange={(o) => !o && setShowPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enregistrer un règlement client</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Montant</Label><Input type="number" step="0.001" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            <div>
              <Label>Mode</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Référence</Label><Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPayFor(null)}>Annuler</Button><Button onClick={doPay}>Valider règlement</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <SourceDocumentPicker
        open={showSourcePicker}
        onOpenChange={setShowSourcePicker}
        direction="vente"
        onApply={applyCommercialDraft}
      />
    </Card>
  );
}


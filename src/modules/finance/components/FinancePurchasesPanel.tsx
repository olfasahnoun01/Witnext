import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatMontantDt } from '../lib/money';
import { TIMBRE_FISCAL_FACTURE_DT } from '../lib/tunisiaFiscal';
import type { InvoiceLineRow, InvoiceRow, InvoiceWriteInput, VatRate } from '../types';
import {
  cancelSalesInvoice,
  computeInvoiceLine,
  computeInvoiceTotals,
  createPurchaseInvoice,
  deleteFinanceInvoice,
  updatePurchaseInvoice,
  validatePurchaseInvoice,
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
  subject_to_fodec: false,
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

/** Factures fournisseurs — saisie, timbre, FODEC, validation comptable achats (Tunisie). */
export function FinancePurchasesPanel({
  companyId,
  invoices,
  linesByInvoice,
  fournisseurs = [],
  onReload,
}: {
  companyId: string;
  invoices: InvoiceRow[];
  linesByInvoice: Record<string, InvoiceLineRow[]>;
  fournisseurs?: CounterpartyOption[];
  onReload: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<InvoiceWriteInput, 'company_id'>>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<CounterpartyOption | null>(null);
  const [pendingSourceRef, setPendingSourceRef] = useState<FinanceSourceRef | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(
      (inv) =>
        !q ||
        inv.numero.toLowerCase().includes(q) ||
        String(inv.counterpart_name || '')
          .toLowerCase()
          .includes(q)
    );
  }, [invoices, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSelectedFournisseur(null);
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
    const match = fournisseurs.find(
      (f) =>
        f.raisonSociale.toLowerCase() === draft.counterpart_name.toLowerCase() ||
        (draft.counterpart_tax_id && f.matriculeFiscal === draft.counterpart_tax_id)
    );
    setSelectedFournisseur(match ?? null);
    setShowForm(true);
  };

  const openEdit = (inv: InvoiceRow) => {
    const lines = linesByInvoice[inv.id] || [];
    const meta = (inv.metadata || {}) as Record<string, unknown>;
    setEditing(inv);
    setForm({
      numero: inv.numero,
      counterpart_name: inv.counterpart_name || '',
      counterpart_tax_id: inv.counterpart_tax_id || '',
      issue_date: inv.issue_date,
      due_date: inv.due_date || '',
      notes: inv.notes || '',
      apply_timbre_fiscal: !!meta.apply_timbre_fiscal,
      lines:
        lines.length > 0
          ? lines.map((l) => ({
              product_code: l.product_code || '',
              description: l.description,
              quantity: Number(l.quantity),
              unit_price_ht: Number(l.unit_price_ht),
              vat_rate: Number(l.vat_rate) as VatRate,
              subject_to_fodec: false,
            }))
          : [emptyLine()],
    });
    setShowForm(true);
  };

  const upsert = async () => {
    if (!form.numero.trim() || !form.counterpart_name.trim()) {
      toast.error('Numéro et fournisseur obligatoires.');
      return;
    }
    setBusy(true);
    try {
      const payload: InvoiceWriteInput = {
        company_id: companyId,
        ...form,
        apply_timbre_fiscal: !!form.apply_timbre_fiscal,
      };
      let invoiceId: string;
      if (editing) {
        await updatePurchaseInvoice(editing.id, payload);
        invoiceId = editing.id;
        toast.success('Facture achat mise à jour');
      } else {
        invoiceId = await createPurchaseInvoice(payload);
        toast.success('Facture achat créée');
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const totalsPreview = computeInvoiceTotals(form.lines, { apply_timbre_fiscal: form.apply_timbre_fiscal });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Achats — Factures fournisseurs</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" className="gap-1" onClick={() => setShowSourcePicker(true)}>
            <FileInput className="h-4 w-4" />
            Importer pièce
          </Button>
          <Button onClick={openCreate}>Nouvelle facture achat</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono">{inv.numero}</TableCell>
                <TableCell>{inv.issue_date}</TableCell>
                <TableCell>{inv.counterpart_name}</TableCell>
                <TableCell className="tabular-nums">{formatMontantDt(Number(inv.total_ttc))}</TableCell>
                <TableCell>{inv.status}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {inv.status === 'draft' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(inv)}>
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await validatePurchaseInvoice(inv, linesByInvoice[inv.id] || []);
                            toast.success('Validée — écriture 401/607/4456');
                            await onReload();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Erreur');
                          }
                        }}
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!confirm('Supprimer ?')) return;
                          await deleteFinanceInvoice(inv.id);
                          toast.success('Supprimée');
                          await onReload();
                        }}
                      >
                        Suppr.
                      </Button>
                    </>
                  )}
                  {(inv.status === 'draft' || inv.status === 'issued') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await cancelSalesInvoice(inv.id);
                        toast.success('Annulée');
                        await onReload();
                      }}
                    >
                      Annuler
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Nouvelle'} facture achat</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>N°</Label>
                <Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <Label>Fournisseur (annuaire Achats)</Label>
                <CounterpartyCombobox
                  options={fournisseurs}
                  value={selectedFournisseur}
                  placeholder="Sélectionner un fournisseur…"
                  onChange={(f) => {
                    setSelectedFournisseur(f);
                    if (f) {
                      setForm((prev) => ({
                        ...prev,
                        counterpart_name: f.raisonSociale,
                        counterpart_tax_id: f.matriculeFiscal || '',
                      }));
                    }
                  }}
                />
              </div>
              <div>
                <Label>MF</Label>
                <Input
                  value={form.counterpart_tax_id || ''}
                  onChange={(e) => setForm((f) => ({ ...f, counterpart_tax_id: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Nom fournisseur (libre ou complément)</Label>
                <Input
                  value={form.counterpart_name}
                  onChange={(e) => setForm((f) => ({ ...f, counterpart_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={!!form.apply_timbre_fiscal}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, apply_timbre_fiscal: c === true }))}
                />
                <Label>Timbre fiscal ({formatMontantDt(TIMBRE_FISCAL_FACTURE_DT)})</Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Lignes facture</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
                >
                  Ajouter ligne
                </Button>
              </div>
              {form.lines.map((line, idx) => {
                const lineCalc = computeInvoiceLine(line);
                return (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[100px_1fr_90px_110px_80px_100px_100px_100px_80px_80px] items-end border-t pt-2"
                  >
                    <div>
                      <Label>Code</Label>
                      <Input
                        value={line.product_code || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, product_code: e.target.value } : l
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Désignation</Label>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, description: e.target.value } : l
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Qté</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={line.quantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, quantity: Number(e.target.value) || 0 } : l
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>PU HT</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.unit_price_ht}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, unit_price_ht: Number(e.target.value) || 0 } : l
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Remise %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={line.remise_percent ?? 0}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, remise_percent: Number(e.target.value) || 0 } : l
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Mt remise</Label>
                      <Input
                        readOnly
                        className="bg-muted tabular-nums"
                        value={lineCalc.montant_remise.toFixed(3)}
                      />
                    </div>
                    <div>
                      <Label>Net HT</Label>
                      <Input
                        readOnly
                        className="bg-muted tabular-nums"
                        value={lineCalc.total_ht.toFixed(3)}
                      />
                    </div>
                    <div>
                      <Label>TVA %</Label>
                      <Select
                        value={String(line.vat_rate)}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, vat_rate: Number(v) as VatRate } : l
                            ),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[19, 13, 7, 0].map((r) => (
                            <SelectItem key={r} value={String(r)}>
                              {r} %
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>FODEC</Label>
                      <div className="flex h-10 items-center gap-2">
                        <Checkbox
                          checked={!!line.subject_to_fodec}
                          onCheckedChange={(c) =>
                            setForm((f) => ({
                              ...f,
                              lines: f.lines.map((l, i) =>
                                i === idx ? { ...l, subject_to_fodec: c === true } : l
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mb-0.5"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines,
                        }))
                      }
                    >
                      Retirer
                    </Button>
                  </div>
                );
              })}
            </div>

            <p className="text-sm tabular-nums border rounded p-2 space-y-1">
              <span>
                Brut {formatMontantDt(totalsPreview.brut_ht)} | Remise{' '}
                {formatMontantDt(totalsPreview.montant_remise)} | Net HT{' '}
                {formatMontantDt(totalsPreview.total_ht)}
              </span>
              <br />
              <span>
                TTC : <strong>{formatMontantDt(totalsPreview.total_ttc)}</strong> (timbre inclus si coché)
              </span>
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Fermer
              </Button>
              <Button onClick={() => void upsert()} disabled={busy}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SourceDocumentPicker
          open={showSourcePicker}
          onOpenChange={setShowSourcePicker}
          direction="achat"
          onApply={applyCommercialDraft}
        />
      </CardContent>
    </Card>
  );
}

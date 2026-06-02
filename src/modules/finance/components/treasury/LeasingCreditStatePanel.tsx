import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Car, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { BANQUES_TUNISIE } from '../../lib/constants';
import { formatMontantDt, parseMontantInput } from '../../lib/money';
import {
  deleteLeasingContract,
  loadLeasingContracts,
  newLeasingContractId,
  updateScheduleCell,
  upsertLeasingContract,
} from '../../services/leasingCreditStorage';
import {
  emptyLeasingYearSchedule,
  LEASING_LINE_KINDS,
  LEASING_LINE_LABELS,
  LEASING_MONTH_LABELS,
  type LeasingCreditContract,
  type LeasingLineKind,
} from '../../types/leasingCredit';

interface LeasingCreditStatePanelProps {
  companyId: string;
}

interface NewContractForm {
  bankName: string;
  contractNumber: string;
  contractDate: string;
}

const EMPTY_FORM: NewContractForm = {
  bankName: '',
  contractNumber: '',
  contractDate: new Date().toISOString().slice(0, 10),
};

export function LeasingCreditStatePanel({ companyId }: LeasingCreditStatePanelProps) {
  const now = new Date().getFullYear();
  const [year, setYear] = useState(now);
  const [contracts, setContracts] = useState<LeasingCreditContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<NewContractForm>(EMPTY_FORM);

  const years = Array.from({ length: 6 }, (_, i) => now - 2 + i);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContracts(await loadLeasingContracts(companyId, year));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement impossible');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCellChange = (
    contractId: string,
    month: number,
    line: LeasingLineKind,
    raw: string
  ) => {
    const value = parseMontantInput(raw) ?? 0;
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId
          ? { ...c, monthlySchedule: updateScheduleCell(c.monthlySchedule, month, line, value) }
          : c
      )
    );
  };

  const handleSaveContract = async (contract: LeasingCreditContract) => {
    setSavingId(contract.id);
    try {
      const saved = await upsertLeasingContract({
        id: contract.id,
        companyId: contract.companyId,
        bankName: contract.bankName,
        contractNumber: contract.contractNumber,
        contractDate: contract.contractDate,
        year: contract.year,
        monthlySchedule: contract.monthlySchedule,
      });
      setContracts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      toast.success(`Contrat ${saved.contractNumber} enregistré`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSavingId(null);
    }
  };

  const handleAddContract = async () => {
    if (!form.bankName.trim() || !form.contractNumber.trim()) {
      toast.error('Banque et numéro de contrat obligatoires');
      return;
    }
    const draft: LeasingCreditContract = {
      id: newLeasingContractId(),
      companyId,
      bankName: form.bankName.trim(),
      contractNumber: form.contractNumber.trim(),
      contractDate: form.contractDate,
      year,
      monthlySchedule: emptyLeasingYearSchedule(),
      createdAt: new Date().toISOString(),
    };
    setSavingId(draft.id);
    try {
      const saved = await upsertLeasingContract(draft);
      setContracts((prev) => [...prev, saved].sort((a, b) => a.bankName.localeCompare(b.bankName)));
      setAddOpen(false);
      setForm(EMPTY_FORM);
      toast.success('Contrat crédit-bail ajouté');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (contract: LeasingCreditContract) => {
    if (!window.confirm(`Supprimer le contrat ${contract.contractNumber} ?`)) return;
    try {
      await deleteLeasingContract(contract.id);
      setContracts((prev) => prev.filter((c) => c.id !== contract.id));
      toast.success('Contrat supprimé');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            État de crédit leasing (véhicules)
          </CardTitle>
          <CardDescription>
            Échéancier mensuel par contrat — Marge, Capital, TVA, Timbre, TTC et Assurance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <Label>Exercice</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
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
          <Button variant="outline" size="sm" className="gap-1" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" className="gap-1 ml-auto" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau contrat
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
          Aucun contrat pour {year}. Ajoutez un contrat crédit-bail.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="min-w-[120px] sticky left-0 bg-muted/40 z-10">Banque</TableHead>
                <TableHead className="min-w-[110px]">N° contrat</TableHead>
                <TableHead className="min-w-[100px]">Date contrat</TableHead>
                <TableHead className="min-w-[90px] sticky left-[120px] bg-muted/40 z-10" />
                {LEASING_MONTH_LABELS.map((label) => (
                  <TableHead key={label} className="text-center min-w-[88px] text-xs">
                    {label}
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) =>
                LEASING_LINE_KINDS.map((line, lineIdx) => (
                  <TableRow key={`${contract.id}-${line}`} className="hover:bg-muted/20">
                    {lineIdx === 0 && (
                      <>
                        <TableCell
                          rowSpan={LEASING_LINE_KINDS.length}
                          className="align-top font-medium sticky left-0 bg-card z-10 border-r"
                        >
                          {contract.bankName}
                        </TableCell>
                        <TableCell
                          rowSpan={LEASING_LINE_KINDS.length}
                          className="align-top font-mono text-sm"
                        >
                          {contract.contractNumber}
                        </TableCell>
                        <TableCell rowSpan={LEASING_LINE_KINDS.length} className="align-top text-sm">
                          {new Date(contract.contractDate).toLocaleDateString('fr-FR')}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-xs font-medium text-muted-foreground sticky left-[120px] bg-card z-10 border-r">
                      {LEASING_LINE_LABELS[line]}
                    </TableCell>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const amount = contract.monthlySchedule[String(month)]?.[line] ?? 0;
                      return (
                        <TableCell key={month} className="p-1">
                          <Input
                            className="h-8 text-xs tabular-nums text-right px-2"
                            inputMode="decimal"
                            value={amount === 0 ? '' : String(amount)}
                            placeholder="0"
                            onChange={(e) =>
                              handleCellChange(contract.id, month, line, e.target.value)
                            }
                            title={`${LEASING_LINE_LABELS[line]} — ${LEASING_MONTH_LABELS[i]} : ${formatMontantDt(amount)}`}
                          />
                        </TableCell>
                      );
                    })}
                    {lineIdx === 0 && (
                      <TableCell rowSpan={LEASING_LINE_KINDS.length} className="align-top">
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                            disabled={savingId === contract.id}
                            onClick={() => void handleSaveContract(contract)}
                          >
                            {savingId === contract.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            Enregistrer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-destructive hover:text-destructive"
                            onClick={() => void handleDelete(contract)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau contrat crédit-bail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Banque</Label>
              <Select
                value={form.bankName}
                onValueChange={(v) => setForm((f) => ({ ...f, bankName: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {BANQUES_TUNISIE.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou saisir le nom de la société de leasing"
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>N° contrat</Label>
              <Input
                value={form.contractNumber}
                onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date contrat</Label>
              <Input
                type="date"
                value={form.contractDate}
                onChange={(e) => setForm((f) => ({ ...f, contractDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleAddContract()} disabled={savingId !== null}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

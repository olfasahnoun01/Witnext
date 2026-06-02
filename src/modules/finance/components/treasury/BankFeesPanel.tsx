import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Landmark, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatMontantDt, parseMontantInput } from '../../lib/money';
import { computeAvoirLineTotals } from '../../services/financeService';
import {
  addBankFee,
  loadBankFeeTypes,
  loadBankFees,
  saveCustomBankFeeType,
} from '../../services/bankFeesStorage';
import { loadTreasuryAccounts } from '../../services/treasuryStorage';
import type {
  BankFeeCharge,
  BankFeeTypeDefinition,
  TauxTvaTunisie,
  TreasuryAccount,
} from '../../types/financeDomain';
import { REGLEMENT_STATUS_LABELS } from '../../services/paymentService';

interface BankFeesPanelProps {
  companyId: string;
}

export function BankFeesPanel({ companyId }: BankFeesPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [feeTypes, setFeeTypes] = useState<BankFeeTypeDefinition[]>([]);
  const [fees, setFees] = useState<BankFeeCharge[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([loadTreasuryAccounts(companyId), loadBankFeeTypes(companyId), loadBankFees(companyId)])
      .then(([accs, types, feeRows]) => {
        if (!active) return;
        setAccounts(accs.filter((a) => a.actif && a.type === 'BANQUE'));
        setFeeTypes(types);
        setFees(feeRows);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Chargement des frais impossible'));
    return () => {
      active = false;
    };
  }, [companyId, refreshKey]);

  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [label, setLabel] = useState('');
  const [montantHt, setMontantHt] = useState('');
  const [tauxTva, setTauxTva] = useState<TauxTvaTunisie>(19);
  const [dateOperation, setDateOperation] = useState(new Date().toISOString().slice(0, 10));
  const [dateEcheance, setDateEcheance] = useState('');
  const [status, setStatus] = useState<'PAYEE' | 'IMPAYEE' | 'EN_COURS'>('EN_COURS');
  const [notes, setNotes] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');

  const preview = useMemo(() => {
    const ht = parseMontantInput(montantHt);
    if (ht == null || ht <= 0) return null;
    return computeAvoirLineTotals({
      id: 'p',
      description: label || 'Frais',
      montantHt: ht,
      tauxTva,
      montantTva: 0,
      montantTtc: 0,
    });
  }, [montantHt, tauxTva, label]);

  const handleAddType = async () => {
    try {
      const t = await saveCustomBankFeeType(companyId, newTypeLabel);
      setFeeTypeId(t.id);
      setNewTypeLabel('');
      setRefreshKey((k) => k + 1);
      toast.success('Type de frais ajouté');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleSubmit = async () => {
    const ht = parseMontantInput(montantHt);
    const account = accounts.find((a) => a.id === treasuryAccountId);
    const feeType = feeTypes.find((t) => t.id === feeTypeId);
    if (!account || !feeType || ht == null || ht <= 0) {
      toast.error('Compte, type et montant HT obligatoires.');
      return;
    }
    const calc = computeAvoirLineTotals({
      id: 'x',
      description: label || feeType.label,
      montantHt: ht,
      tauxTva,
      montantTva: 0,
      montantTtc: 0,
    });
    try {
      await addBankFee(companyId, {
        companyId,
        treasuryAccountId: account.id,
        treasuryAccountName: account.nom,
        feeTypeId: feeType.id,
        feeTypeLabel: feeType.label,
        label: label.trim() || feeType.label,
        montantHt: calc.montantHt,
        tauxTva,
        montantTva: calc.montantTva,
        montantTtc: calc.montantTtc,
        dateOperation,
        dateEcheance: dateEcheance || null,
        status,
        notes: notes.trim() || null,
      });
      toast.success('Frais bancaire enregistré');
      setMontantHt('');
      setLabel('');
      setNotes('');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Frais bancaires
          </CardTitle>
          <CardDescription>
            Commissions, intérêts créditeurs/débiteurs — TVA 0 % ou 19 %.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Compte banque</Label>
              <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Compte" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type de frais</Label>
              <Select value={feeTypeId} onValueChange={setFeeTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {feeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Libellé (optionnel)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Détail…" />
            </div>
            <div className="space-y-2">
              <Label>Montant HT</Label>
              <Input inputMode="decimal" value={montantHt} onChange={(e) => setMontantHt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TVA</Label>
              <Select value={String(tauxTva)} onValueChange={(v) => setTauxTva(Number(v) as TauxTvaTunisie)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 %</SelectItem>
                  <SelectItem value="19">19 %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYEE">Payée</SelectItem>
                  <SelectItem value="EN_COURS">En cours</SelectItem>
                  <SelectItem value="IMPAYEE">Impayée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date opération</Label>
              <Input type="date" value={dateOperation} onChange={(e) => setDateOperation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date échéance</Label>
              <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
            </div>
          </div>

          {preview && (
            <p className="text-sm tabular-nums">
              TTC : <strong>{formatMontantDt(preview.montantTtc)}</strong> (TVA {formatMontantDt(preview.montantTva)})
            </p>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Nouveau type personnalisé</Label>
              <Input
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                placeholder="Ex. Frais SWIFT"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void handleAddType()}>
              Ajouter type
            </Button>
            <Button type="button" className="gap-1" onClick={() => void handleSubmit()}>
              <Plus className="h-4 w-4" />
              Enregistrer frais
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique frais bancaires</CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun frais enregistré.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>HT</TableHead>
                    <TableHead>TVA</TableHead>
                    <TableHead>TTC</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.dateOperation}</TableCell>
                      <TableCell>{f.treasuryAccountName}</TableCell>
                      <TableCell>{f.label}</TableCell>
                      <TableCell className="tabular-nums">{formatMontantDt(f.montantHt)}</TableCell>
                      <TableCell className="tabular-nums">{formatMontantDt(f.montantTva)}</TableCell>
                      <TableCell className="tabular-nums">{formatMontantDt(f.montantTtc)}</TableCell>
                      <TableCell>{f.dateEcheance || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === 'IMPAYEE' ? 'destructive' : 'outline'}>
                          {REGLEMENT_STATUS_LABELS[f.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

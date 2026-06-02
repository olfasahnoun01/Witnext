import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatMontantDt, parseMontantInput } from '../../lib/money';
import { executerVirementInterComptes } from '../../services/financeService';
import type { TreasuryAccount } from '../../types/financeDomain';

interface InterAccountTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  accounts: TreasuryAccount[];
  onSuccess: (accounts: TreasuryAccount[]) => void;
}

/** Modal virement inter-comptes (source → destination). */
export function InterAccountTransferDialog({
  open,
  onOpenChange,
  companyId,
  accounts,
  onSuccess,
}: InterAccountTransferDialogProps) {
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [montant, setMontant] = useState('');
  const [dateOp, setDateOp] = useState(new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);

  const selectable = accounts.filter((a) => a.actif && a.type !== 'ATTENTE_EFFETS');

  const handleSubmit = async () => {
    const m = parseMontantInput(montant);
    if (m == null || m <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    if (!sourceId || !destId) {
      toast.error('Sélectionnez les deux comptes.');
      return;
    }
    setBusy(true);
    try {
      const updated = await executerVirementInterComptes({
        companyId,
        compteSourceId: sourceId,
        compteDestinationId: destId,
        montant: m,
        dateOperation: dateOp,
        motif: motif.trim() || 'Virement interne',
      });
      toast.success('Virement enregistré');
      onSuccess(updated);
      onOpenChange(false);
      setMontant('');
      setMotif('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Virement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Virement inter-comptes
          </DialogTitle>
          <DialogDescription>
            Débit du compte source et crédit du compte destination (transaction unique).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Compte source</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nom} — {formatMontantDt(a.soldeActuel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Compte destination</Label>
            <Select value={destId} onValueChange={setDestId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {selectable
                  .filter((a) => a.id !== sourceId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nom}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Montant</Label>
              <Input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={dateOp} onChange={(e) => setDateOp(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motif</Label>
            <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Valider le virement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

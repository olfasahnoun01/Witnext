import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import type { TreasuryAccount, TreasuryAccountType } from '../../types/financeDomain';
import { loadTreasuryAccounts, saveTreasuryAccounts } from '../../services/treasuryStorage';

interface TreasuryAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSaved: (accounts: TreasuryAccount[]) => void;
  defaultType?: TreasuryAccountType;
}

/** Création d'un compte banque ou caisse (paramétrage local). */
export function TreasuryAccountFormDialog({
  open,
  onOpenChange,
  companyId,
  onSaved,
  defaultType = 'BANQUE',
}: TreasuryAccountFormDialogProps) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TreasuryAccountType>(defaultType);
  const [codeComptable, setCodeComptable] = useState(defaultType === 'CAISSE' ? '531000' : '512100');
  const [rib, setRib] = useState('');
  const [banque, setBanque] = useState('');

  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!nom.trim()) return;
    setBusy(true);
    try {
      const acc: TreasuryAccount = {
        id: `acc-${Date.now()}`,
        companyId,
        nom: nom.trim(),
        type,
        codeComptable: codeComptable.trim() || (type === 'CAISSE' ? '531000' : '512100'),
        rib: rib.replace(/\s/g, '') || null,
        banqueLabel: banque || null,
        soldeActuel: 0,
        actif: true,
        createdAt: new Date().toISOString(),
      };
      await saveTreasuryAccounts(companyId, [acc]);
      const accounts = await loadTreasuryAccounts(companyId);
      onSaved(accounts);
      onOpenChange(false);
      setNom('');
      toast.success('Compte créé');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création du compte impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau compte de trésorerie</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nom</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TreasuryAccountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANQUE">Banque</SelectItem>
                <SelectItem value="CAISSE">Caisse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Code comptable</Label>
            <Input value={codeComptable} onChange={(e) => setCodeComptable(e.target.value)} />
          </div>
          {type === 'BANQUE' && (
            <>
              <div>
                <Label>RIB (24 chiffres)</Label>
                <Input value={rib} onChange={(e) => setRib(e.target.value)} maxLength={24} />
              </div>
              <div>
                <Label>Banque</Label>
                <Input value={banque} onChange={(e) => setBanque(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

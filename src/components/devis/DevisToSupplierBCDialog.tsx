import { useEffect, useState, useCallback } from 'react';
import { Devis } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { documentService } from '@/services/documentService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Truck } from 'lucide-react';

interface DevisToSupplierBCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devis: Devis | null;
  onSuccess: () => void;
}

export const DevisToSupplierBCDialog = ({
  open,
  onOpenChange,
  devis,
  onSuccess,
}: DevisToSupplierBCDialogProps) => {
  const [fournisseurs, setFournisseurs] = useState<{ id: number; nom: string }[]>([]);
  const [fournisseurId, setFournisseurId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const loadFournisseurs = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('id, nom')
        .order('nom');
      if (error) throw error;
      setFournisseurs((data || []) as { id: number; nom: string }[]);
    } catch (e: any) {
      toast.error('Impossible de charger les fournisseurs');
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadFournisseurs();
      setFournisseurId('');
    }
  }, [open, loadFournisseurs]);

  const handleConfirm = async () => {
    if (!devis) return;
    const fid = parseInt(fournisseurId, 10);
    if (!fid) {
      toast.error('Choisissez un fournisseur');
      return;
    }
    setLoading(true);
    try {
      const result = await documentService.createBCFournisseurFromVenteDevis(devis, fid);
      if (!result.success) {
        toast.error(result.error || 'Erreur lors de la création');
        return;
      }
      const numero = 'document' in result && result.document ? result.document.numero : '';
      toast.success(numero ? `BC Fournisseur créé : ${numero}` : 'BC Fournisseur créé');
      onSuccess();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            BC Fournisseur depuis devis
          </DialogTitle>
        </DialogHeader>
        {devis && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Devis client <span className="font-semibold text-foreground">{devis.devis_number}</span>
              {devis.third_party_name ? (
                <> — {devis.third_party_name}</>
              ) : null}
              . Les lignes seront copiées vers un bon de commande fournisseur (module Achats).
            </p>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select value={fournisseurId} onValueChange={setFournisseurId} disabled={loadingList}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingList ? 'Chargement...' : 'Choisir un fournisseur'} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {fournisseurs.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading || !devis}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              'Créer BC Fournisseur'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

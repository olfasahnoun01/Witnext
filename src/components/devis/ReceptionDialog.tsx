import { useState, useEffect, useCallback } from 'react';
import { 
  UnifiedDocument, 
  UnifiedDocumentLine
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PackageCheck, Truck, AlertTriangle } from 'lucide-react';
import { documentService } from '@/modules/commercial';
import { toast } from 'sonner';

interface ReceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBC: UnifiedDocument | null;
  onSuccess: () => void;
}

export const ReceptionDialog = ({
  open,
  onOpenChange,
  sourceBC,
  onSuccess,
}: ReceptionDialogProps) => {
  const [backlog, setBacklog] = useState<any[]>([]);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  const loadBacklog = useCallback(async () => {
    if (!sourceBC) return;
    const data = await documentService.getReceptionBacklog(sourceBC);
    if (data) {
      setBacklog(data);
      // Initialize with remaining quantities
      const initial: Record<number, number> = {};
      data.forEach(item => {
        if (item.product_id) initial[item.product_id] = item.remaining_qty;
      });
      setReceivedQtys(initial);
    }
  }, [sourceBC]);

  useEffect(() => {
    if (open && sourceBC) {
      loadBacklog();
    }
  }, [open, sourceBC, loadBacklog]);

  const handleQtyChange = (productId: number, qty: number, max: number) => {
    setReceivedQtys(prev => ({
      ...prev,
      [productId]: Math.max(0, Math.min(qty, max)),
    }));
  };

  const hasOverReceipt = Object.entries(receivedQtys).some(([id, qty]) => {
    const item = backlog.find((l) => l.product_id === parseInt(id, 10));
    return qty > (item?.remaining_qty ?? 0);
  });

  const handleConfirm = async () => {
    if (!sourceBC) return;
    setLoading(true);

    try {
      const items = Object.entries(receivedQtys)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => {
          const line = backlog.find(l => l.product_id === parseInt(productId));
          return {
            product_id: parseInt(productId),
            quantity: qty,
            unit_price: line?.unit_price || 0
          };
        });

      if (items.length === 0) {
        toast.error("Veuillez saisir au moins une quantité reçue.");
        setLoading(false);
        return;
      }

      if (hasOverReceipt) {
        toast.error('Les quantités reçues ne peuvent pas dépasser le reste à recevoir.');
        setLoading(false);
        return;
      }

      const result = await documentService.createReception(sourceBC, items);
      if (result.success) {
        toast.success("Réception enregistrée (BE n° " + result.be_id + "). Pensez à valider l'entrée en stock.");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error("Erreur : " + result.error);
      }
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sourceBC) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Truck className="w-6 h-6 text-primary" />
            Réception de marchandises : {sourceBC.numero}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Saisissez les quantités réellement reçues pour générer le Bon d'Entrée (BE).
          </p>
        </DialogHeader>

        <div className="py-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-center">Commandé</TableHead>
                  <TableHead className="text-center">Déjà reçu</TableHead>
                  <TableHead className="text-center w-32">Réception maintenant</TableHead>
                  <TableHead className="text-right">Reste à recevoir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlog.map((item) => (
                  <TableRow key={item.id} className={item.remaining_qty === 0 ? "opacity-50 bg-muted/20" : ""}>
                    <TableCell>
                      <p className="font-bold text-sm">{item.product_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                    </TableCell>
                    <TableCell className="text-center font-medium">{item.ordered_qty}</TableCell>
                    <TableCell className="text-center text-green-600 font-bold">{item.already_received}</TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        min="0"
                        value={receivedQtys[item.product_id] || 0}
                        onChange={(e) => handleQtyChange(item.product_id, parseInt(e.target.value) || 0, item.remaining_qty)}
                        disabled={item.remaining_qty === 0}
                        className={cn(
                          "h-8 text-center",
                          (receivedQtys[item.product_id] || 0) > item.remaining_qty && "border-red-500 bg-red-50"
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded",
                        item.remaining_qty > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      )}>
                        {item.remaining_qty}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasOverReceipt && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Attention : Vous recevez plus que ce qui a été commandé pour certains articles.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={loading || hasOverReceipt} className="gap-2 bg-green-600 hover:bg-green-700">
            <PackageCheck className="w-4 h-4" />
            {loading ? "Traitement..." : "Enregistrer la réception"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

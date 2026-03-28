import { memo, useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Loader2, Send, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Echantillon {
  id?: number;
  devis_id: number;
  product_name: string;
  quantity: number;
  status: string;
}

interface EchantillonModalProps {
  devisId: number | null;
  devisNumber: string;
  open: boolean;
  onClose: () => void;
}

export const EchantillonModal = memo(({ devisId, devisNumber, open, onClose }: EchantillonModalProps) => {
  const [records, setRecords] = useState<Echantillon[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);

  const fetchRecords = useCallback(async () => {
    if (!devisId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('echantillons')
      .select('*')
      .eq('devis_id', devisId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching echantillons:', error);
    } else {
      setRecords((data as any[]) || []);
    }
    setLoading(false);
  }, [devisId]);

  useEffect(() => {
    if (open && devisId) fetchRecords();
    if (!open) { setRecords([]); setNewName(''); setNewQty(1); }
  }, [open, devisId, fetchRecords]);

  const addRecord = async () => {
    if (!newName.trim() || !devisId) return;
    setSaving(true);
    const { error } = await supabase.from('echantillons').insert({
      devis_id: devisId,
      product_name: newName.trim(),
      quantity: newQty,
      status: 'envoyé',
    } as any);
    if (error) {
      toast.error("Erreur lors de l'ajout");
      console.error(error);
    } else {
      toast.success('Échantillon ajouté');
      setNewName('');
      setNewQty(1);
      fetchRecords();
    }
    setSaving(false);
  };

  const updateStatus = async (id: number, status: string) => {
    const { error } = await supabase.from('echantillons').update({ status } as any).eq('id', id);
    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
  };

  const deleteRecord = async (id: number) => {
    const { error } = await supabase.from('echantillons').delete().eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Échantillons — {devisNumber}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Add new */}
            <div className="flex items-end gap-2 mb-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Produit</label>
                <Input
                  placeholder="Nom du produit"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="w-20">
                <label className="text-xs text-muted-foreground mb-1 block">Qté</label>
                <Input
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={e => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>
              <Button size="sm" onClick={addRecord} disabled={saving || !newName.trim()} className="h-9 gap-1.5">
                <Plus className="w-4 h-4" />
                Ajouter
              </Button>
            </div>

            {/* Records list */}
            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun échantillon enregistré.
              </div>
            ) : (
              <div className="space-y-2">
                {records.map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qté: {r.quantity}</p>
                    </div>
                    <Select value={r.status} onValueChange={v => updateStatus(r.id!, v)}>
                      <SelectTrigger className={`h-8 w-28 text-xs ${
                        r.status === 'envoyé' ? 'text-warning border-warning/30' : 'text-success border-success/30'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="envoyé">
                          <span className="flex items-center gap-1.5">
                            <Send className="w-3 h-3" /> Envoyé
                          </span>
                        </SelectItem>
                        <SelectItem value="reçu">
                          <span className="flex items-center gap-1.5">
                            <RotateCcw className="w-3 h-3" /> Reçu
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => deleteRecord(r.id!)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

EchantillonModal.displayName = 'EchantillonModal';

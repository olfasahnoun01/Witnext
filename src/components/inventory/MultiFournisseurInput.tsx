import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductGroupFournisseur } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface MultiFournisseurInputProps {
  value: ProductGroupFournisseur[];
  onChange: (fournisseurs: ProductGroupFournisseur[]) => void;
}

export const MultiFournisseurInput = ({ value, onChange }: MultiFournisseurInputProps) => {
  const [existingFournisseurs, setExistingFournisseurs] = useState<string[]>([]);

  useEffect(() => {
    const fetchFournisseurs = async () => {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('nom')
        .order('nom');
      
      if (!error && data) {
        const uniqueNames = Array.from(new Set(data.map(f => f.nom).filter(Boolean)));
        setExistingFournisseurs(uniqueNames);
      }
    };
    
    fetchFournisseurs();
  }, []);

  const addFournisseur = useCallback(() => {
    onChange([...value, { fournisseur_name: '', prix: 0, remise: 0, prix_ttc: 0, fiche_technique_url: null, phone: '' }]);
  }, [value, onChange]);

  const removeFournisseur = useCallback((index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }, [value, onChange]);

  const updateFournisseur = useCallback((index: number, field: keyof ProductGroupFournisseur, fieldValue: string | number) => {
    const updated = value.map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: fieldValue };
        if (field === 'prix' || field === 'remise') {
          const prix = field === 'prix' ? (fieldValue as number) : newItem.prix;
          const remise = field === 'remise' ? (fieldValue as number) : newItem.remise;
          newItem.prix_ttc = prix * (1 - remise / 100);
        }
        return newItem;
      }
      return item;
    });
    onChange(updated);
  }, [value, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Fournisseurs, Prix & Remise</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFournisseur}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>
      
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aucun fournisseur ajouté. Cliquez sur "Ajouter" pour spécifier des fournisseurs.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    list={`fournisseur-list-${index}`}
                    value={item.fournisseur_name}
                    onChange={(e) => updateFournisseur(index, 'fournisseur_name', e.target.value)}
                    placeholder="Nom du fournisseur"
                    className="h-9"
                  />
                  <datalist id={`fournisseur-list-${index}`}>
                    {existingFournisseurs
                      .filter(f => !value.some((v, i) => i !== index && v.fournisseur_name === f))
                      .map(f => (
                        <option key={f} value={f} />
                      ))}
                  </datalist>
                </div>
                <div className="w-40">
                  <Input
                    value={item.phone || ''}
                    onChange={(e) => updateFournisseur(index, 'phone', e.target.value)}
                    placeholder="Téléphone"
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFournisseur(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Prix HT</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={item.prix || ''}
                    onChange={(e) => updateFournisseur(index, 'prix', parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Remise (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={item.remise || ''}
                    onChange={(e) => updateFournisseur(index, 'remise', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Montant HT</label>
                  <div className="h-9 px-3 rounded-md bg-muted border border-border text-primary font-medium flex items-center text-sm">
                    {item.prix_ttc.toFixed(3)} DT
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Ajoutez plusieurs fournisseurs avec leurs prix et remises pour comparer les offres.
      </p>
    </div>
  );
};

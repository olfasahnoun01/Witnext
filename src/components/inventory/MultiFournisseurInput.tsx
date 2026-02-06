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

  // Fetch existing fournisseurs for autocomplete
  useEffect(() => {
    const fetchFournisseurs = async () => {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('nom')
        .order('nom');
      
      if (!error && data) {
        setExistingFournisseurs(data.map(f => f.nom));
      }
    };
    
    fetchFournisseurs();
  }, []);

  const addFournisseur = useCallback(() => {
    onChange([...value, { fournisseur_name: '', prix_ttc: 0 }]);
  }, [value, onChange]);

  const removeFournisseur = useCallback((index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }, [value, onChange]);

  const updateFournisseur = useCallback((index: number, field: 'fournisseur_name' | 'prix_ttc', fieldValue: string | number) => {
    const updated = value.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: fieldValue };
      }
      return item;
    });
    onChange(updated);
  }, [value, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Fournisseurs et Prix TTC</Label>
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
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
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
              <div className="w-32">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.prix_ttc || ''}
                  onChange={(e) => updateFournisseur(index, 'prix_ttc', parseFloat(e.target.value) || 0)}
                  placeholder="Prix TTC"
                  className="h-9"
                />
              </div>
              <span className="text-sm text-muted-foreground">DT</span>
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
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Ajoutez plusieurs fournisseurs avec leurs prix TTC respectifs pour comparer les offres.
      </p>
    </div>
  );
};

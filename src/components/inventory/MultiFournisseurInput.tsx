import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, FileText, Upload, Eye, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductGroupFournisseur } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface MultiFournisseurInputProps {
  value: ProductGroupFournisseur[];
  onChange: (fournisseurs: ProductGroupFournisseur[]) => void;
}

export const MultiFournisseurInput = ({ value, onChange }: MultiFournisseurInputProps) => {
  const [existingFournisseurs, setExistingFournisseurs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  const handleFicheUpload = useCallback(async (index: number, file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PDF, JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setUploadingIndex(index);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `fiches/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fiches-techniques')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('fiches-techniques')
        .getPublicUrl(filePath);

      const updated = value.map((item, i) => 
        i === index ? { ...item, fiche_technique_url: urlData.publicUrl } : item
      );
      onChange(updated);

      // If fournisseur has an ID (already saved), update DB directly
      const item = value[index];
      if (item.id) {
        await supabase.from('product_group_fournisseurs')
          .update({ fiche_technique_url: urlData.publicUrl })
          .eq('id', item.id);
      }

      toast.success('Fiche technique téléchargée');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploadingIndex(null);
    }
  }, [value, onChange]);

  const removeFiche = useCallback(async (index: number) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, fiche_technique_url: null } : item
    );
    onChange(updated);

    const item = value[index];
    if (item.id) {
      await supabase.from('product_group_fournisseurs')
        .update({ fiche_technique_url: null })
        .eq('id', item.id);
    }
  }, [value, onChange]);

  const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

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
                  <label className="text-xs text-muted-foreground mb-1 block">Prix (TND)</label>
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
                  <label className="text-xs text-muted-foreground mb-1 block">Prix TTC</label>
                  <div className="h-9 px-3 rounded-md bg-muted border border-border text-primary font-medium flex items-center text-sm">
                    {item.prix_ttc.toFixed(3)} DT
                  </div>
                </div>
              </div>

              {/* Fiche technique upload */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={el => { fileInputRefs.current[index] = el; }}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFicheUpload(index, file);
                    e.target.value = '';
                  }}
                />
                {item.fiche_technique_url ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">Fiche technique</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setPreviewUrl(item.fiche_technique_url!)}
                      title="Prévisualiser"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={item.fiche_technique_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeFiche(index)}
                      title="Supprimer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={uploadingIndex === index}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingIndex === index ? 'Envoi...' : 'Fiche technique'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Ajoutez plusieurs fournisseurs avec leurs prix et remises pour comparer les offres.
      </p>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Fiche Technique</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex-1 overflow-auto min-h-0">
              {isPdf(previewUrl) ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[75vh] rounded-md border"
                  title="Fiche technique PDF"
                />
              ) : (
                <div className="overflow-auto max-h-[75vh]">
                  <img
                    src={previewUrl}
                    alt="Fiche technique"
                    className="w-full h-auto rounded-md"
                  />
                </div>
              )}
              <div className="flex justify-end mt-3">
                <a
                  href={previewUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

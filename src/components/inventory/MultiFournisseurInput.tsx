import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, FileText, Upload, Eye, Download, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

/** Parse fiche_technique_url which may be a single URL string or a JSON array string */
function parseFicheUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch { return []; }
  }
  return [trimmed];
}

function serializeFicheUrls(urls: string[]): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

export const MultiFournisseurInput = ({ value, onChange }: MultiFournisseurInputProps) => {
  const [existingFournisseurs, setExistingFournisseurs] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
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

  const handleFicheUpload = useCallback(async (index: number, files: FileList) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;

    const validFiles = Array.from(files).filter(f => {
      if (!allowedTypes.includes(f.type)) {
        toast.error(`Format non supporté: ${f.name}`);
        return false;
      }
      if (f.size > maxSize) {
        toast.error(`Fichier trop volumineux: ${f.name} (max 10 Mo)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploadingIndex(index);
    try {
      const { convertImageFileToWebp, convertPdfAllPagesToWebp } = await import('@/lib/imageCompression');

      // Collect all blobs to upload
      const blobs: Blob[] = [];
      for (const file of validFiles) {
        if (file.type === 'application/pdf') {
          const pages = await convertPdfAllPagesToWebp(file);
          blobs.push(...pages.map(p => p.blob));
        } else {
          const { blob } = await convertImageFileToWebp(file);
          blobs.push(blob);
        }
      }

      // Upload all blobs
      const newUrls: string[] = [];
      for (const blob of blobs) {
        const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const filePath = `fiches/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('fiches-techniques')
          .upload(filePath, blob, { contentType: 'image/webp' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('fiches-techniques')
          .getPublicUrl(filePath);

        newUrls.push(urlData.publicUrl);
      }

      // Merge with existing URLs
      const existingUrls = parseFicheUrls(value[index].fiche_technique_url);
      const allUrls = [...existingUrls, ...newUrls];
      const serialized = serializeFicheUrls(allUrls);

      const updated = value.map((item, i) =>
        i === index ? { ...item, fiche_technique_url: serialized } : item
      );
      onChange(updated);

      const item = value[index];
      if (item.id) {
        await supabase.from('product_group_fournisseurs')
          .update({ fiche_technique_url: serialized })
          .eq('id', item.id);
      }

      toast.success(`${newUrls.length} fiche(s) technique(s) ajoutée(s)`);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploadingIndex(null);
    }
  }, [value, onChange]);

  const removeSingleFiche = useCallback(async (fournisseurIndex: number, ficheUrlIndex: number) => {
    const urls = parseFicheUrls(value[fournisseurIndex].fiche_technique_url);
    urls.splice(ficheUrlIndex, 1);
    const serialized = serializeFicheUrls(urls);

    const updated = value.map((item, i) =>
      i === fournisseurIndex ? { ...item, fiche_technique_url: serialized } : item
    );
    onChange(updated);

    const item = value[fournisseurIndex];
    if (item.id) {
      await supabase.from('product_group_fournisseurs')
        .update({ fiche_technique_url: serialized })
        .eq('id', item.id);
    }
  }, [value, onChange]);

  const openPreview = useCallback((urls: string[], startIndex: number = 0) => {
    setPreviewUrls(urls);
    setPreviewIndex(startIndex);
  }, []);

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
          {value.map((item, index) => {
            const ficheUrls = parseFicheUrls(item.fiche_technique_url);
            return (
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

                {/* Fiche technique upload - multi-file */}
                <div className="space-y-1.5 pt-1">
                  <input
                    ref={el => { fileInputRefs.current[index] = el; }}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleFicheUpload(index, files);
                      e.target.value = '';
                    }}
                  />

                  {/* Thumbnails of uploaded fiches */}
                  {ficheUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ficheUrls.map((url, fi) => (
                        <div key={fi} className="relative group w-12 h-12 rounded border border-border overflow-hidden bg-background">
                          <img
                            src={url}
                            alt={`Fiche ${fi + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => openPreview(ficheUrls, fi)}
                          />
                          <button
                            type="button"
                            className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeSingleFiche(index, fi)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={uploadingIndex === index}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    {uploadingIndex === index ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi...</>
                    ) : (
                      <><Upload className="w-3.5 h-3.5" /> {ficheUrls.length > 0 ? 'Ajouter fiches' : 'Fiche technique'}</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Ajoutez plusieurs fournisseurs avec leurs prix et remises pour comparer les offres.
      </p>

      {/* Preview dialog with gallery navigation */}
      <Dialog open={previewUrls.length > 0} onOpenChange={() => setPreviewUrls([])}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Fiche Technique {previewUrls.length > 1 && `(${previewIndex + 1}/${previewUrls.length})`}
            </DialogTitle>
          </DialogHeader>
          {previewUrls.length > 0 && (
            <div className="flex-1 overflow-auto min-h-0">
              <div className="overflow-auto max-h-[75vh] relative">
                <img
                  src={previewUrls[previewIndex]}
                  alt="Fiche technique"
                  className="w-full h-auto rounded-md"
                />
                {previewUrls.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80"
                      disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex(i => i - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80"
                      disabled={previewIndex === previewUrls.length - 1}
                      onClick={() => setPreviewIndex(i => i + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex justify-end mt-3">
                <a
                  href={previewUrls[previewIndex]}
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

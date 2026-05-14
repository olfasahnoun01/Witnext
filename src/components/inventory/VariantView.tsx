import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, RefreshCw, Edit, Trash2, Package, Upload, FileText, Eye, Download, X, FileDown, DownloadCloud, FileIcon, Loader2 } from 'lucide-react';
import { ProductGroup, Product, StockStatus } from '@/types';
import { getVariantsByGroupId, createVariant } from '@/services/productGroupService';
import { updateProduct, deleteProduct } from '@/services/dbService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { compressImage, formatBytes, getBase64Size } from '@/lib/imageCompression';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatVariantAddedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm', { locale: fr });
  } catch {
    return '—';
  }
}

interface VariantViewProps {
  group: ProductGroup;
  onBack: () => void;
}

const getStockStatus = (product: Product): StockStatus => {
  if (product.quantity === 0) return 'out_of_stock';
  if (product.quantity <= product.min_stock) return 'low_stock';
  return 'in_stock';
};

const statusStyles: Record<StockStatus, { bg: string; text: string; label: string }> = {
  in_stock: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'En stock' },
  low_stock: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Stock faible' },
  out_of_stock: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rupture' }
};

/** Parse fiche_technique_url which can be a single URL string or a JSON array of URLs */
function parseFicheUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch { /* not JSON */ }
  return [raw];
}

function serializeFicheUrls(urls: string[]): string {
  if (urls.length === 0) return '';
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

interface VariantFormData {
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  remise: number;
  image: string | null;
  fiche_urls: string[];
}

const emptyFormData: VariantFormData = {
  sku: '', size: '', color: '', quantity: 0, price: 0, remise: 0, image: null, fiche_urls: []
};

export const VariantView = ({ group, onBack }: VariantViewProps) => {
  const { isModerator } = useAuth();
  const [variants, setVariants] = useState<Product[]>([]);
  const [freshFournisseurs, setFreshFournisseurs] = useState<typeof group.fournisseurs>(group.fournisseurs);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ficheOnlyMode, setFicheOnlyMode] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [formData, setFormData] = useState<VariantFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewFicheUrls, setPreviewFicheUrls] = useState<string[]>([]);
  const [previewFicheIndex, setPreviewFicheIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ficheInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFiche, setIsUploadingFiche] = useState(false);

  const fetchVariants = useCallback(async () => {
    setIsLoading(true);
    try {
      const [variantsData, fournisseursResult] = await Promise.all([
        getVariantsByGroupId(group.id),
        supabase.from('product_group_fournisseurs').select('*').eq('product_group_id', group.id)
      ]);
      setVariants(variantsData);
      if (fournisseursResult.data) {
        setFreshFournisseurs(fournisseursResult.data.map(f => ({
          id: f.id,
          product_group_id: f.product_group_id,
          fournisseur_name: f.fournisseur_name,
          prix: Number(f.prix_ttc),
          remise: 0,
          prix_ttc: Number(f.prix_ttc),
          fiche_technique_url: f.fiche_technique_url || null
        })));
      }
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [group.id]);

  useEffect(() => { fetchVariants(); }, [fetchVariants]);

  useRealtimeData({ tables: ['products'], onDataChange: fetchVariants, showToast: false });

  const totalStock = variants.reduce((sum, v) => sum + v.quantity, 0);

  const handleOpenModal = useCallback(async (variant?: Product) => {
    if (variant) {
      setEditingVariant(variant);
      setFormData({
        sku: variant.sku,
        size: variant.size || '',
        color: variant.color || '',
        quantity: variant.quantity,
        price: variant.price,
        remise: variant.remise || 0,
        image: variant.image || null,
        fiche_urls: parseFicheUrls(variant.fiche_technique_url)
      });
    } else {
      // Find primary supplier price to use as default
      const defaultPrice = freshFournisseurs.length > 0 ? freshFournisseurs[0].prix_ttc : 0;
      
      setFormData({
        ...emptyFormData,
        sku: `${group.base_sku || 'NEW'}-${variants.length + 1}`,
        price: defaultPrice
      });
    }
    setIsModalOpen(true);
  }, [group.id, group.base_sku, variants.length]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file);
        const originalSize = file.size;
        const compressedSize = getBase64Size(compressedImage);
        console.log(`Image compressed to JPEG: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
        setFormData(prev => ({ ...prev, image: compressedImage }));
      } catch (error) {
        console.error('Error compressing image:', error);
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            setFormData(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 1.0) }));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const uploadBlobToStorage = useCallback(async (blob: Blob, fileName: string): Promise<string> => {
    const filePath = `fiches/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('fiches-techniques').upload(filePath, blob, {
      upsert: true
    });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, []);

  const handleFicheUpload = useCallback(async (files: FileList) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Format non supporté: ${file.name}. Utilisez PDF, JPG ou PNG.`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Fichier trop volumineux: ${file.name} (max 20 Mo)`);
        return;
      }
    }

    setIsUploadingFiche(true);
    try {
      const newUrls: string[] = [];

      for (const file of fileArray) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `fiche_${timestamp}_${safeName}`;
        
        const url = await uploadBlobToStorage(file, fileName);
        newUrls.push(url);
      }

      const updatedUrls = [...formData.fiche_urls, ...newUrls];
      setFormData(prev => ({ ...prev, fiche_urls: updatedUrls }));

      // If editing, save directly via secure RPC
      if (editingVariant) {
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: serializeFicheUrls(updatedUrls),
        } as any);
      }
      toast.success(`${newUrls.length} fiche(s) technique(s) ajoutée(s)`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploadingFiche(false);
    }
  }, [editingVariant, formData.fiche_urls, uploadBlobToStorage]);

  const handleRemoveFiche = useCallback(async (index: number) => {
    const updatedUrls = formData.fiche_urls.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, fiche_urls: updatedUrls }));

    // If editing, save directly
    if (editingVariant) {
      await supabase.rpc('update_product_fiche_technique', {
        _product_id: editingVariant.id,
        _fiche_technique_url: serializeFicheUrls(updatedUrls),
      } as any);
      toast.success('Fiche technique supprimée');
    }
  }, [editingVariant, formData.fiche_urls]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingVariant(null);
    setFormData(emptyFormData);
    setFicheOnlyMode(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.sku.trim() && !ficheOnlyMode) {
      toast.error('Le code article est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const serializedFiches = serializeFicheUrls(formData.fiche_urls);

      if (ficheOnlyMode && editingVariant) {
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: serializedFiches,
        } as any);
        toast.success('Fiches techniques mises à jour');
      } else if (editingVariant) {
        await updateProduct(editingVariant.id, {
          sku: formData.sku,
          size: formData.size || undefined,
          color: formData.color || undefined,
          quantity: formData.quantity,
          price: formData.price,
          remise: formData.remise,
          image: formData.image
        });
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: serializedFiches,
        } as any);
        toast.success('Variante mise à jour');
      } else {
        const result = await createVariant(group.id, {
          sku: formData.sku,
          size: formData.size,
          color: formData.color,
          quantity: formData.quantity,
          price: formData.price,
          remise: formData.remise
        });
        
        if (!result.success) {
          toast.error(result.error || 'Erreur lors de la création');
          return;
        }
        if (formData.fiche_urls.length > 0 && result.id) {
          await supabase.rpc('update_product_fiche_technique', {
            _product_id: result.id,
            _fiche_technique_url: serializedFiches,
          } as any);
        }
        toast.success('Variante créée');
      }
      
      handleCloseModal();
      fetchVariants();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingVariant, formData, group.id, ficheOnlyMode, handleCloseModal, fetchVariants]);

  const handleDelete = useCallback(async (variant: Product) => {
    if (!window.confirm(`Supprimer la variante "${variant.sku}" ?`)) return;
    try {
      await deleteProduct(variant.id);
      toast.success('Variante supprimée');
      fetchVariants();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  }, [fetchVariants]);

  const [previewData, setPreviewData] = useState<{ urls: string[], index: number, title: string } | null>(null);

  const openPreview = useCallback((urls: string[], index = 0, title: string) => {
    setPreviewData({ urls, index, title });
  }, []);

  const downloadFichesAsPdf = useCallback(async (variant: Product) => {
    const urls = parseFicheUrls(variant.fiche_technique_url);
    if (urls.length === 0) return;

    toast.info('Génération du PDF en cours...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;

      for (let i = 0; i < urls.length; i++) {
        if (i > 0) pdf.addPage();

        // Fetch image as blob then convert to base64
        const response = await fetch(urls[i]);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Draw image on canvas at native resolution, export as PNG (lossless)
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = base64;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const pngBase64 = canvas.toDataURL('image/png');

        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;

        pdf.addImage(pngBase64, 'PNG', x, y, w, h, undefined, 'NONE');
      }

      const fileName = `FicheTechnique-${group.name.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ -_]/g, '_')}.pdf`;
      pdf.save(fileName);
      toast.success('PDF téléchargé');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Erreur lors de la génération du PDF');
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div className="flex items-center gap-4">
            {group.image ? (
              <img src={group.image} alt={group.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">{group.name}</h2>
              <p className="text-sm text-muted-foreground">
                {variants.length} variante{variants.length !== 1 ? 's' : ''} • {totalStock} unités en stock
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVariants} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          {isModerator && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter Variante
            </Button>
          )}
        </div>
      </div>

      {/* Product info summary */}
      <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Code Article Base</p>
          <p className="font-medium">{group.base_sku || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Catégorie</p>
          <p className="font-medium">{group.category}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Seuil d'alerte</p>
          <p className="font-medium">{group.min_stock} unités</p>
        </div>
      </div>

      {/* Fournisseurs horizontal scrollable */}
      {group.fournisseurs && group.fournisseurs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Fournisseurs</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {group.fournisseurs.map((f, index) => (
              <div key={f.id || index} className="flex-shrink-0 bg-muted/50 rounded-lg px-4 py-2 border border-border">
                <p className="font-medium text-foreground whitespace-nowrap">{f.fournisseur_name}</p>
                <p className="text-sm text-primary whitespace-nowrap">{f.prix_ttc.toFixed(3)} TND</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variants table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : variants.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune variante pour ce produit.</p>
          {isModerator && (
            <Button className="mt-4" onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter la première variante
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code Article</TableHead>
                <TableHead className="whitespace-nowrap">{"Date d'ajout"}</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Remise %</TableHead>
                <TableHead className="text-right">Net HT</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Fiches Techniques</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => {
                const status = getStockStatus(variant);
                const style = statusStyles[status];
                const ficheUrls = parseFicheUrls(variant.fiche_technique_url);
                
                return (
                  <TableRow key={variant.id}>
                    <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatVariantAddedAt(variant.created_at)}
                    </TableCell>
                    <TableCell>{variant.size || '-'}</TableCell>
                    <TableCell>{variant.color || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{variant.quantity}</TableCell>
                    <TableCell className="text-right">{variant.price.toFixed(3)} TND</TableCell>
                    <TableCell className="text-right">{variant.remise ? `${variant.remise}%` : '-'}</TableCell>
                    <TableCell className="text-right">{(variant.price * (1 - (variant.remise || 0) / 100)).toFixed(3)} TND</TableCell>
                    <TableCell>
                      <Badge className={`${style.bg} ${style.text} border-0`}>{style.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {ficheUrls.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                            title="Prévisualiser" onClick={() => openPreview(ficheUrls, 0, variant.sku)}>
                            <FileText className="w-3.5 h-3.5" />
                            <span>{ficheUrls.length}</span>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            title="Télécharger en PDF" onClick={() => downloadFichesAsPdf(variant)}>
                            <FileDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isModerator ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(variant)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(variant)}
                              className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" title="Gérer les fiches techniques"
                            onClick={() => { setFicheOnlyMode(true); handleOpenModal(variant); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ficheOnlyMode ? 'Fiches Techniques' : (editingVariant ? 'Modifier la variante' : 'Ajouter une variante')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {!ficheOnlyMode && (
              <>
                {/* Image Upload */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}>
                    {formData.image ? (
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Image de l'article</p>
                    <p className="text-xs text-muted-foreground">Cliquez pour télécharger (optionnel)</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sku">Code Article *</Label>
                  <Input id="sku" value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="ex: 00001P.C.N" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="size">Taille</Label>
                    <Input id="size" value={formData.size}
                      onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                      placeholder="ex: 42, L, XL" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="color">Couleur</Label>
                    <Input id="color" value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="ex: Noir, Bleu" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantité</Label>
                    <Input id="quantity" type="number" min="0" value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Prix HT</Label>
                    <Input id="price" type="number" min="0" step="0.001" value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div className="grid gap-2 max-w-xs">
                  <Label htmlFor="remise">Remise (%)</Label>
                  <Input id="remise" type="number" min="0" max="100" step="0.1" value={formData.remise}
                    onChange={(e) => setFormData(prev => ({ ...prev, remise: parseFloat(e.target.value) || 0 }))}
                    placeholder="0" />
                </div>
              </>
            )}

            {/* Fiches techniques - multiple upload */}
            <div className="space-y-3">
              <Label>Fiches Techniques ({formData.fiche_urls.length})</Label>
              <input ref={ficheInputRef} type="file" accept=".pdf,image/jpeg,image/png" multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) handleFicheUpload(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Grid of existing fiches */}
              {formData.fiche_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.fiche_urls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-lg border border-border overflow-hidden bg-muted/30">
                      <img src={url.toLowerCase().endsWith('.pdf') ? 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg' : url} 
                        alt={`Fiche ${idx + 1}`}
                        className="w-full h-24 object-cover cursor-pointer bg-white"
                        onClick={() => openPreview(formData.fiche_urls, idx, formData.sku || 'Fiche Technique')} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <Button type="button" variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-white hover:text-white hover:bg-white/20"
                          onClick={() => openPreview(formData.fiche_urls, idx, formData.sku || 'Fiche Technique')}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-white hover:text-destructive hover:bg-white/20"
                          onClick={() => handleRemoveFiche(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                        {idx + 1}/{formData.fiche_urls.length}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button type="button" variant="outline" size="sm" className="gap-2 w-full"
                disabled={isUploadingFiche} onClick={() => ficheInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                {isUploadingFiche ? 'Envoi en cours...' : 'Ajouter des fiches techniques'}
              </Button>
              <p className="text-xs text-muted-foreground">
                PDF (toutes les pages converties en images), JPG ou PNG (max 20 Mo). Sélection multiple possible.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : (editingVariant ? 'Mettre à jour' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewData} onOpenChange={(open) => !open && setPreviewData(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="truncate pr-8 flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-primary" />
               Aperçu: {previewData?.title} {previewData && previewData.urls.length > 1 && `(${previewData.index + 1}/${previewData.urls.length})`}
            </DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm" 
                className="gap-2 font-bold shadow-lg"
                onClick={() => {
                  if (!previewData) return;
                  const url = previewData.urls[previewData.index];
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `fiche_${previewData.title}_${previewData.index + 1}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <DownloadCloud className="w-4 h-4" />
                TELECHARGER
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-muted/20 relative overflow-hidden flex flex-col">
            <div className="flex-1 relative">
              {previewData?.urls[previewData.index] ? (
                previewData.urls[previewData.index].toLowerCase().endsWith('.pdf') || previewData.urls[previewData.index].includes('/fiches/') ? (
                  <iframe 
                    src={`${previewData.urls[previewData.index]}#toolbar=0`} 
                    className="w-full h-full border-none"
                    title="Document Preview"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img 
                      src={previewData.urls[previewData.index]} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                    />
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Navigation footer if multiple */}
            {previewData && previewData.urls.length > 1 && (
              <div className="p-3 border-t bg-background flex items-center justify-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={previewData.index === 0}
                  onClick={() => setPreviewData(prev => prev ? { ...prev, index: prev.index - 1 } : null)}
                >
                  ← Précédent
                </Button>
                <span className="text-sm font-medium">
                  Page {previewData.index + 1} / {previewData.urls.length}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={previewData.index === previewData.urls.length - 1}
                  onClick={() => setPreviewData(prev => prev ? { ...prev, index: prev.index + 1 } : null)}
                >
                  Suivant →
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

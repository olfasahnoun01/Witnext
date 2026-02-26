import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, RefreshCw, Edit, Trash2, Package, Upload, FileText, Eye, Download, X } from 'lucide-react';
import { ProductGroup, Product, StockStatus } from '@/types';
import { getVariantsByGroupId, createVariant } from '@/services/productGroupService';
import { updateProduct, deleteProduct } from '@/services/dbService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { compressImage, formatBytes, getBase64Size } from '@/lib/imageCompression';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useAuth } from '@/hooks/useAuth';

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

interface VariantFormData {
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  remise: number;
  image: string | null;
  fiche_technique_url: string | null;
}

const emptyFormData: VariantFormData = {
  sku: '',
  size: '',
  color: '',
  quantity: 0,
  price: 0,
  remise: 0,
  image: null,
  fiche_technique_url: null
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
  const [previewFicheUrl, setPreviewFicheUrl] = useState<string | null>(null);
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

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // Subscribe to realtime changes on products table
  useRealtimeData({
    tables: ['products'],
    onDataChange: fetchVariants,
    showToast: true
  });

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
        fiche_technique_url: variant.fiche_technique_url || null
      });
    } else {
      setEditingVariant(null);
      setFormData({
        ...emptyFormData,
        sku: `${group.base_sku || 'NEW'}-${variants.length + 1}`
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
        console.log(`Image compressed to WebP: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
        
        setFormData(prev => ({ ...prev, image: compressedImage }));
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback: still convert to WebP via canvas
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            setFormData(prev => ({ ...prev, image: canvas.toDataURL('image/webp', 0.7) }));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const handleFicheUpload = useCallback(async (file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PDF, JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setIsUploadingFiche(true);
    try {
      const { convertImageFileToWebp } = await import('@/lib/imageCompression');
      const { blob, ext } = await convertImageFileToWebp(file);
      const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `fiches/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('fiches-techniques').upload(filePath, blob, {
        contentType: 'image/webp',
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, fiche_technique_url: urlData.publicUrl }));

      // If editing, save directly on the product via secure RPC
      if (editingVariant) {
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: urlData.publicUrl,
        });
      }
      toast.success('Fiche technique téléchargée');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploadingFiche(false);
    }
  }, [editingVariant]);

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
      if (ficheOnlyMode && editingVariant) {
        // Only update fiche technique via secure RPC
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: formData.fiche_technique_url ?? '',
        } as any);
        toast.success('Fiche technique mise à jour');
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
        // Save fiche technique via secure RPC
        await supabase.rpc('update_product_fiche_technique', {
          _product_id: editingVariant.id,
          _fiche_technique_url: formData.fiche_technique_url ?? '',
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
        // Save fiche technique via secure RPC
        if (formData.fiche_technique_url && result.id) {
          await supabase.rpc('update_product_fiche_technique', {
            _product_id: result.id,
            _fiche_technique_url: formData.fiche_technique_url,
          });
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
              <img 
                src={group.image} 
                alt={group.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
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
              <div 
                key={f.id || index}
                className="flex-shrink-0 bg-muted/50 rounded-lg px-4 py-2 border border-border"
              >
                <p className="font-medium text-foreground whitespace-nowrap">{f.fournisseur_name}</p>
                <p className="text-sm text-primary whitespace-nowrap">{f.prix_ttc.toFixed(3)} TND</p>
                {f.fiche_technique_url && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => setPreviewFicheUrl(f.fiche_technique_url!)}
                    >
                      <Eye className="w-3 h-3" />
                      Voir
                    </Button>
                    <a
                      href={f.fiche_technique_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs hover:bg-muted transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                )}
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
                <TableHead>Taille</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Remise %</TableHead>
                <TableHead className="text-right">Prix TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Fiche Technique</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => {
                const status = getStockStatus(variant);
                const style = statusStyles[status];
                const ficheUrl = variant.fiche_technique_url;
                
                  return (
                    <TableRow key={variant.id}>
                      <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
                      <TableCell>{variant.size || '-'}</TableCell>
                      <TableCell>{variant.color || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{variant.quantity}</TableCell>
                      <TableCell className="text-right">{variant.price.toFixed(3)} TND</TableCell>
                      <TableCell className="text-right">{variant.remise ? `${variant.remise}%` : '-'}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{variant.prix_ttc?.toFixed(3) || variant.price.toFixed(3)} TND</TableCell>
                      <TableCell>
                        <Badge className={`${style.bg} ${style.text} border-0`}>
                          {style.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ficheUrl ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              title="Prévisualiser"
                              onClick={() => setPreviewFicheUrl(ficheUrl)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <a
                              href={ficheUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isModerator ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenModal(variant)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(variant)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Gérer la fiche technique"
                              onClick={() => {
                                setFicheOnlyMode(true);
                                handleOpenModal(variant);
                              }}
                            >
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ficheOnlyMode ? 'Fiche Technique' : (editingVariant ? 'Modifier la variante' : 'Ajouter une variante')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {!ficheOnlyMode && (
              <>
                {/* Image Upload */}
                <div className="flex items-center gap-4">
                  <div 
                    className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.image ? (
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Image de l'article</p>
                    <p className="text-xs text-muted-foreground">Cliquez pour télécharger (optionnel)</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sku">Code Article *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="ex: 00001P.C.N"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="size">Taille</Label>
                    <Input
                      id="size"
                      value={formData.size}
                      onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                      placeholder="ex: 42, L, XL"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="color">Couleur</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="ex: Noir, Bleu"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantité</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Prix (TND)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.001"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="remise">Remise (%)</Label>
                    <Input
                      id="remise"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.remise}
                      onChange={(e) => setFormData(prev => ({ ...prev, remise: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Prix TTC (calculé)</Label>
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm font-medium text-primary flex items-center">
                      {(formData.price * (1 - formData.remise / 100)).toFixed(3)} TND
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Fiche technique upload */}
            <div className="space-y-2">
              <Label>Fiche Technique</Label>
              <input
                ref={ficheInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFicheUpload(file);
                  e.target.value = '';
                }}
              />
              {formData.fiche_technique_url ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">Fiche technique</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPreviewFicheUrl(formData.fiche_technique_url!)}
                    title="Prévisualiser"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <a
                    href={formData.fiche_technique_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs gap-1"
                    onClick={() => ficheInputRef.current?.click()}
                    title="Remplacer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setFormData(prev => ({ ...prev, fiche_technique_url: null }))}
                    title="Supprimer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isUploadingFiche}
                  onClick={() => ficheInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingFiche ? 'Envoi en cours...' : 'Ajouter une fiche technique'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou WebP (max 10 Mo)</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : (editingVariant ? 'Mettre à jour' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fiche technique preview dialog */}
      <Dialog open={!!previewFicheUrl} onOpenChange={() => setPreviewFicheUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Fiche Technique</DialogTitle>
          </DialogHeader>
          {previewFicheUrl && (
            <div className="flex-1 overflow-auto min-h-0">
              {previewFicheUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewFicheUrl}
                  className="w-full h-[75vh] rounded-md border"
                  title="Fiche technique PDF"
                />
              ) : (
                <div className="overflow-auto max-h-[75vh]">
                  <img
                    src={previewFicheUrl}
                    alt="Fiche technique"
                    className="w-full h-auto rounded-md"
                  />
                </div>
              )}
              <div className="flex justify-end mt-3">
                <a
                  href={previewFicheUrl}
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

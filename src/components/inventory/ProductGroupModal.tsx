import { useState, useEffect, useCallback, useRef, memo, createRef } from 'react';
import { X, Upload, Package, Plus, Trash2, ArrowLeft, ArrowRight, FileUp, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductGroup, ProductGroupFournisseur } from '@/types';
import { compressImage, formatBytes, getBase64Size } from '@/lib/imageCompression';
import { MultiFournisseurInput } from './MultiFournisseurInput';
import { createVariant } from '@/services/productGroupService';

// Default categories as fallback
const DEFAULT_CATEGORIES = [
  'Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 
  'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Tablier'
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];
const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Gris Charbon', 'Marron', 'Beige', 'Bleu Marine'];

interface ProductGroupFormData {
  name: string;
  category: string;
  base_sku: string;
  min_stock: number;
  image: string | null;
  fournisseurs: ProductGroupFournisseur[];
}

interface VariantDraft {
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  remise: number;
  fiche_technique_file?: File | null;
  fiche_technique_url?: string | null;
}

interface ProductGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCategory?: string;
  defaultName?: string;
  editingGroup?: ProductGroup | null;
}

const emptyFormData: ProductGroupFormData = {
  name: '',
  category: '',
  base_sku: '',
  min_stock: 5,
  image: null,
  fournisseurs: [],
};

export const ProductGroupModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCategory,
  defaultName,
  editingGroup,
}: ProductGroupModalProps) => {
  const [formData, setFormData] = useState<ProductGroupFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Step management (only for creation)
  const [step, setStep] = useState<1 | 2>(1);
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  // Load all categories from database
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('product_groups')
        .select('category')
        .order('category');
      
      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(p => p.category))].filter(Boolean);
        const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...uniqueCategories])].sort();
        setCategories(allCategories);
      }
    };
    
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Initialize form when modal opens
  useEffect(() => {
    const initializeForm = async () => {
      if (editingGroup) {
        setStep(1); // No step 2 for editing
        setVariants([]);
        setFormData({
          name: editingGroup.name,
          category: editingGroup.category,
          base_sku: editingGroup.base_sku || '',
          min_stock: editingGroup.min_stock,
          image: editingGroup.image,
          fournisseurs: [],
        });
        
        if (editingGroup.id) {
          const { data, error } = await supabase
            .from('product_group_fournisseurs')
            .select('*')
            .eq('product_group_id', editingGroup.id);
          
          if (!error && data && data.length > 0) {
            setFormData(prev => ({
              ...prev,
              fournisseurs: data.map(f => ({
                id: f.id,
                product_group_id: f.product_group_id,
                fournisseur_name: f.fournisseur_name,
                prix: Number(f.prix_ttc),
                remise: 0,
                prix_ttc: Number(f.prix_ttc),
                fiche_technique_url: f.fiche_technique_url || null,
              })),
            }));
          } else if (editingGroup.fournisseur && editingGroup.fournisseur.trim()) {
            setFormData(prev => ({
              ...prev,
              fournisseurs: [{ fournisseur_name: editingGroup.fournisseur!, prix: 0, remise: 0, prix_ttc: 0 }],
            }));
          }
        }
      } else {
        setStep(1);
        setVariants([]);
        setFormData({
          ...emptyFormData,
          name: defaultName || '',
          category: defaultCategory || '',
        });
      }
    };
    
    if (isOpen) {
      initializeForm();
    }
  }, [isOpen, editingGroup, defaultCategory]);

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

  // Validate step 1
  const validateStep1 = useCallback(() => {
    if (!formData.name.trim()) {
      toast.error('Le nom du produit est requis');
      return false;
    }
    if (!formData.category.trim()) {
      toast.error('La catégorie est requise');
      return false;
    }
    return true;
  }, [formData.name, formData.category]);

  // Go to step 2
  const goToStep2 = useCallback(() => {
    if (!validateStep1()) return;
    // Add one empty variant by default if none
    if (variants.length === 0) {
      const baseSku = formData.base_sku || '';
      // Inherit base price and remise from first supplier if available
      const firstFourn = formData.fournisseurs.length > 0 ? formData.fournisseurs[0] : null;
      const defaultPrice = firstFourn ? firstFourn.prix : 0;
      const defaultRemise = firstFourn ? firstFourn.remise : 0;
      
      setVariants([{ 
        sku: `${baseSku}-1`, 
        size: '', 
        color: '', 
        quantity: 0,
        price: defaultPrice,
        remise: defaultRemise 
      }]);
    }
    setStep(2);
  }, [validateStep1, variants.length, formData.base_sku, formData.fournisseurs]);

  // Add variant row
  const addVariantRow = useCallback(() => {
    setVariants(prev => {
      const nextIndex = prev.length + 1;
      const baseSku = formData.base_sku || '';
      // Inherit base price and remise from first supplier if available
      const firstFourn = formData.fournisseurs.length > 0 ? formData.fournisseurs[0] : null;
      const defaultPrice = firstFourn ? firstFourn.prix : 0;
      const defaultRemise = firstFourn ? firstFourn.remise : 0;
      
      return [...prev, { 
        sku: `${baseSku}-${nextIndex}`, 
        size: '', 
        color: '', 
        quantity: 0,
        price: defaultPrice,
        remise: defaultRemise 
      }];
    });
  }, [formData.base_sku, formData.fournisseurs]);

  // Remove variant row
  const removeVariantRow = useCallback((index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update variant
  const updateVariant = useCallback((index: number, field: keyof VariantDraft, value: string | number) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom du produit est requis');
      return;
    }
    if (!formData.category.trim()) {
      toast.error('La catégorie est requise');
      return;
    }

    setIsSubmitting(true);
    try {
      let groupId: number;
      
      const primaryFournisseur = formData.fournisseurs.length > 0 
        ? formData.fournisseurs[0].fournisseur_name 
        : null;

      if (editingGroup) {
        const { error } = await supabase
          .from('product_groups')
          .update({
            name: formData.name.trim(),
            category: formData.category.trim(),
            base_sku: formData.base_sku.trim() || null,
            fournisseur: primaryFournisseur,
            min_stock: formData.min_stock,
            image: formData.image,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        groupId = editingGroup.id;

        const categoryChanged =
          formData.category.trim() !== (editingGroup.category || '').trim();
        const nameChanged = formData.name.trim() !== editingGroup.name.trim();

        if (categoryChanged || nameChanged) {
          const variantUpdates: Record<string, string> = {};
          if (categoryChanged) variantUpdates.category = formData.category.trim();
          if (nameChanged) variantUpdates.name = formData.name.trim();

          const { error: variantError } = await supabase
            .from('products')
            .update(variantUpdates)
            .eq('product_group_id', editingGroup.id);

          if (variantError) throw variantError;
        }
        
        await supabase
          .from('product_group_fournisseurs')
          .delete()
          .eq('product_group_id', groupId);
      } else {
        const { data, error } = await supabase
          .from('product_groups')
          .insert({
            name: formData.name.trim(),
            category: formData.category.trim(),
            base_sku: formData.base_sku.trim() || null,
            fournisseur: primaryFournisseur,
            min_stock: formData.min_stock,
            image: formData.image,
          })
          .select('id')
          .single();

        if (error) throw error;
        groupId = data.id;
      }
      
      // Insert fournisseurs
      if (formData.fournisseurs.length > 0) {
        const fournisseursToInsert = formData.fournisseurs
          .filter(f => f.fournisseur_name.trim())
          .map(f => ({
            product_group_id: groupId,
            fournisseur_name: f.fournisseur_name.trim(),
            prix_ttc: f.prix_ttc || 0,
            fiche_technique_url: f.fiche_technique_url || null,
          }));
        
        if (fournisseursToInsert.length > 0) {
          const { error: fournisseurError } = await supabase
            .from('product_group_fournisseurs')
            .insert(fournisseursToInsert);
          
          if (fournisseurError) throw fournisseurError;
        }
      }

      // Create variants (only for new product groups, step 2)
      if (!editingGroup && variants.length > 0) {
        const validVariants = variants.filter(v => v.sku.trim());
        for (const v of validVariants) {
          const result = await createVariant(groupId, {
            sku: v.sku.trim(),
            size: v.size || undefined,
            color: v.color || undefined,
            quantity: v.quantity,
            price: v.price || 0,
            remise: v.remise || 0,
          });
          if (!result.success) {
            console.error(`Failed to create variant ${v.sku}:`, result.error);
            continue;
          }
          // Upload fiche technique if provided
          if (v.fiche_technique_file && result.id) {
            const timestamp = Date.now();
            const safeName = v.fiche_technique_file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const filePath = `fiches/fiche_var_${result.id}_${timestamp}_${safeName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('fiches-techniques')
              .upload(filePath, v.fiche_technique_file, {
                upsert: true
              });
              
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('fiches-techniques')
                .getPublicUrl(filePath);
              await supabase
                .from('products')
                .update({ fiche_technique_url: urlData.publicUrl })
                .eq('id', result.id);
            }
          }
        }
        if (validVariants.length > 0) {
          toast.success(`${validVariants.length} variante(s) créée(s)`);
        }
      }

      toast.success(editingGroup ? 'Produit mis à jour' : 'Produit créé avec succès');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving product group:', error);
      if (error.code === '23505') {
        toast.error('Cet article (nom + catégorie) existe déjà dans la base de données');
      } else {
        toast.error(error.message || 'Erreur lors de l\'enregistrement');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingGroup, variants, onSuccess, onClose]);

  const isCreating = !editingGroup;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {editingGroup ? 'Modifier le produit' : (
              step === 1 ? 'Créer un Nouvel Article — Étape 1/2' : 'Ajouter des Variantes — Étape 2/2'
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Gérez les détails de l'article, les fournisseurs et les variantes.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2">
            {/* Image Upload */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <div
                  className="w-full h-full rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                {formData.image && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, image: null }));
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/90"
                    title="Supprimer l'image"
                    aria-label="Supprimer l'image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
                <p className="text-sm font-medium text-foreground">Image du produit</p>
                <p className="text-xs text-muted-foreground">Cliquez pour télécharger (optionnel)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom du produit *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Pantalon de Travail Pro"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="base_sku">Code Article *</Label>
                <Input
                  id="base_sku"
                  value={formData.base_sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_sku: e.target.value }))}
                  placeholder="ex: PAN-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Catégorie *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50 max-h-[300px]">
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock">Stock Minimum *</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <MultiFournisseurInput
              value={formData.fournisseurs}
              onChange={(fournisseurs) => setFormData(prev => ({ ...prev, fournisseurs }))}
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Produit : <span className="font-medium text-foreground">{formData.name}</span>
              </p>
              <Button variant="outline" size="sm" onClick={addVariantRow} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            </div>

            {variants.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucune variante. Cliquez sur "Ajouter" pour en créer.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {variants.map((v, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Variante {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeVariantRow(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Code *</Label>
                        <Input
                          value={v.sku}
                          onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                          placeholder="SKU"
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Taille</Label>
                        <Input
                          list="variant-sizes"
                          value={v.size}
                          onChange={(e) => updateVariant(idx, 'size', e.target.value)}
                          placeholder="Taille"
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Coul.</Label>
                        <Input
                          list="variant-colors"
                          value={v.color}
                          onChange={(e) => updateVariant(idx, 'color', e.target.value)}
                          placeholder="Coul."
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Qté</Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.quantity}
                          onChange={(e) => updateVariant(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Prix HT</Label>
                        <DecimalInput
                          value={v.price ?? 0}
                          onValueChange={(val) => updateVariant(idx, 'price', val)}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="grid gap-1 col-span-1">
                        <Label className="text-xs">Rem.%</Label>
                        <DecimalInput
                          value={v.remise ?? 0}
                          onValueChange={(val) => updateVariant(idx, 'remise', val)}
                          allowEmptyZero
                          className="h-8 text-xs px-2"
                        />
                      </div>
                    </div>
                    {/* Fiche technique upload */}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        id={`variant-fiche-${idx}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            if (file.type !== 'application/pdf') {
                              toast.error('Format non supporté. Utilisez uniquement des fichiers PDF.');
                              return;
                            }
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('Fichier trop volumineux (max 10 Mo)');
                              return;
                            }
                          }
                          setVariants(prev => prev.map((vv, i) => i === idx ? { ...vv, fiche_technique_file: file } : vv));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => document.getElementById(`variant-fiche-${idx}`)?.click()}
                      >
                        <FileUp className="w-3 h-3" />
                        Fiche technique
                      </Button>
                      {v.fiche_technique_file && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {v.fiche_technique_file.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <datalist id="variant-sizes">
              {SIZES.map(s => <option key={s} value={s} />)}
            </datalist>
            <datalist id="variant-colors">
              {COLORS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          {step === 2 && isCreating && (
            <Button variant="outline" onClick={() => setStep(1)} className="mr-auto gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          {step === 1 && isCreating ? (
            <Button onClick={goToStep2} className="gap-1.5">
              Suivant
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : (editingGroup ? 'Mettre à jour' : 'Créer et Sélectionner')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

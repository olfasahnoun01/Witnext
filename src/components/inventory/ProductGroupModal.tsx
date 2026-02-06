import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { X, Upload, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductGroup } from '@/types';
import { compressImage, formatBytes, getBase64Size } from '@/lib/imageCompression';

// Predefined categories
const CATEGORIES = [
  'Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 
  'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Tablier'
];

interface ProductGroupFormData {
  name: string;
  category: string;
  base_sku: string;
  fournisseur: string;
  min_stock: number;
  image: string | null;
}

interface ProductGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCategory?: string;
  editingGroup?: ProductGroup | null;
}

const emptyFormData: ProductGroupFormData = {
  name: '',
  category: '',
  base_sku: '',
  fournisseur: '',
  min_stock: 5,
  image: null,
};

export const ProductGroupModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCategory,
  editingGroup,
}: ProductGroupModalProps) => {
  const [formData, setFormData] = useState<ProductGroupFormData>(emptyFormData);
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch fournisseurs from database
  useEffect(() => {
    const fetchFournisseurs = async () => {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('nom')
        .order('nom');
      
      if (!error && data) {
        setFournisseurs(data.map(f => f.nom));
      }
    };
    
    if (isOpen) {
      fetchFournisseurs();
    }
  }, [isOpen]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        setFormData({
          name: editingGroup.name,
          category: editingGroup.category,
          base_sku: editingGroup.base_sku || '',
          fournisseur: editingGroup.fournisseur || '',
          min_stock: editingGroup.min_stock,
          image: editingGroup.image,
        });
      } else {
        setFormData({
          ...emptyFormData,
          category: defaultCategory || '',
        });
      }
    }
  }, [isOpen, editingGroup, defaultCategory]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image before storing
        const compressedImage = await compressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.7,
        });
        
        const originalSize = file.size;
        const compressedSize = getBase64Size(compressedImage);
        
        console.log(`Image compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
        
        setFormData(prev => ({ ...prev, image: compressedImage }));
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to original image
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
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
      if (editingGroup) {
        // Update existing group
        const { error } = await supabase
          .from('product_groups')
          .update({
            name: formData.name.trim(),
            category: formData.category.trim(),
            base_sku: formData.base_sku.trim() || null,
            fournisseur: formData.fournisseur.trim() || null,
            min_stock: formData.min_stock,
            image: formData.image,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast.success('Produit mis à jour');
      } else {
        // Create new group
        const { error } = await supabase
          .from('product_groups')
          .insert({
            name: formData.name.trim(),
            category: formData.category.trim(),
            base_sku: formData.base_sku.trim() || null,
            fournisseur: formData.fournisseur.trim() || null,
            min_stock: formData.min_stock,
            image: formData.image,
          });

        if (error) throw error;
        toast.success('Produit créé avec succès');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving product group:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingGroup, onSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingGroup ? 'Modifier le produit' : 'Créer un nouveau produit'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Image Upload */}
          <div className="flex items-center gap-4">
            <div 
              className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.image ? (
                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground" />
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

          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="ex: Pantalon de Travail Pro"
            />
          </div>

          {/* Category with datalist */}
          <div className="grid gap-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Input
              id="category"
              list="category-list"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="Sélectionner ou saisir une nouvelle catégorie"
            />
            <datalist id="category-list">
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Base SKU */}
          <div className="grid gap-2">
            <Label htmlFor="base_sku">Code Article Base</Label>
            <Input
              id="base_sku"
              value={formData.base_sku}
              onChange={(e) => setFormData(prev => ({ ...prev, base_sku: e.target.value }))}
              placeholder="ex: PAN-001 (optionnel)"
            />
          </div>

          {/* Fournisseur with datalist */}
          <div className="grid gap-2">
            <Label htmlFor="fournisseur">Fournisseur</Label>
            <Input
              id="fournisseur"
              list="fournisseur-list"
              value={formData.fournisseur}
              onChange={(e) => setFormData(prev => ({ ...prev, fournisseur: e.target.value }))}
              placeholder="Sélectionner ou saisir un nouveau fournisseur"
            />
            <datalist id="fournisseur-list">
              {fournisseurs.map(f => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Vous pouvez sélectionner un fournisseur existant ou en saisir un nouveau
            </p>
          </div>

          {/* Min Stock */}
          <div className="grid gap-2">
            <Label htmlFor="min_stock">Seuil d'alerte (stock minimum)</Label>
            <Input
              id="min_stock"
              type="number"
              min="0"
              value={formData.min_stock}
              onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : (editingGroup ? 'Mettre à jour' : 'Créer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

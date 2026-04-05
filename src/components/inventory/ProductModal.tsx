import { memo, useRef, useCallback } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/types';

const CATEGORIES = ['Pantalons', 'Blousons', 'Bordequin', 'Accessoires', 'Gants', 'Casques', 'Gilets', 'Polos & T-shirts', 'Parkas et manteaux', 'Non catégorisé'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', 'Unique'];
const COLORS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Jaune', 'Orange', 'Gris', 'Marron', 'Beige'];

export interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  fournisseur: string;
  size: string;
  quantity: number;
  price: number;
  remise: number;
  min_stock: number;
  image: string | null;
  color: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  editingProduct: Product | null;
  formData: ProductFormData;
  onFormDataChange: (data: ProductFormData) => void;
  isSubmitting: boolean;
  defaultCategory?: string;
}

export const ProductModal = memo(({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  formData,
  onFormDataChange,
  isSubmitting,
  defaultCategory
}: ProductModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage } = await import('@/lib/imageCompression');
        const compressed = await compressImage(file);
        onFormDataChange({ ...formData, image: compressed });
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            onFormDataChange({ ...formData, image: canvas.toDataURL('image/jpeg', 1.0) });
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }, [formData, onFormDataChange]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      category: formData.category || defaultCategory || 'Non catégorisé'
    };
    await onSubmit(dataToSubmit);
  }, [formData, defaultCategory, onSubmit]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {editingProduct ? 'Modifier Produit' : 'Ajouter Produit'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Image Upload */}
          <div className="flex items-center gap-4">
            <div 
              className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
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
              <p className="text-sm font-medium text-foreground">Image du produit</p>
              <p className="text-xs text-muted-foreground">Cliquez pour télécharger</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nom du produit *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="Ex: Pantalon de Travail Pro"
              />
            </div>

            <div>
              <label className="form-label">Code Article *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => onFormDataChange({ ...formData, sku: e.target.value })}
                className="form-input"
                placeholder="Ex: PAN-001"
              />
            </div>

            <div>
              <label className="form-label">Catégorie *</label>
              <input
                type="text"
                required
                list="categories"
                value={formData.category || defaultCategory || ''}
                onChange={(e) => onFormDataChange({ ...formData, category: e.target.value })}
                className="form-input"
                placeholder="Sélectionner ou saisir"
              />
              <datalist id="categories">
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">Taille</label>
              <input
                type="text"
                list="sizes"
                value={formData.size}
                onChange={(e) => onFormDataChange({ ...formData, size: e.target.value })}
                className="form-input"
                placeholder="Sélectionner ou saisir (optionnel)"
              />
              <datalist id="sizes">
                {SIZES.map(size => (
                  <option key={size} value={size} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">Fournisseur</label>
              <input
                type="text"
                value={formData.fournisseur}
                onChange={(e) => onFormDataChange({ ...formData, fournisseur: e.target.value })}
                className="form-input"
                placeholder="Nom du fournisseur (optionnel)"
              />
            </div>

            <div>
              <label className="form-label">Prix (TND)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={formData.price}
                onChange={(e) => onFormDataChange({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="form-input"
                placeholder="0.000 (optionnel)"
              />
            </div>

            <div>
              <label className="form-label">Remise (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.remise}
                onChange={(e) => onFormDataChange({ ...formData, remise: parseFloat(e.target.value) || 0 })}
                className="form-input"
                placeholder="0"
              />
            </div>

            <div>
              <label className="form-label">Prix TTC (calculé)</label>
              <div className="h-10 px-3 rounded-lg bg-muted/50 border border-border text-primary font-medium flex items-center">
                {(formData.price * (1 - formData.remise / 100) * 1.19).toFixed(3)} TND
              </div>
            </div>

            <div>
              <label className="form-label">Couleur</label>
              <input
                type="text"
                list="colors"
                value={formData.color}
                onChange={(e) => onFormDataChange({ ...formData, color: e.target.value })}
                className="form-input"
                placeholder="Sélectionner ou saisir (optionnel)"
              />
              <datalist id="colors">
                {COLORS.map(color => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="form-label">Quantité *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.quantity}
                onChange={(e) => onFormDataChange({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Stock Minimum *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.min_stock}
                onChange={(e) => onFormDataChange({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                className="form-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : editingProduct ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});

ProductModal.displayName = 'ProductModal';

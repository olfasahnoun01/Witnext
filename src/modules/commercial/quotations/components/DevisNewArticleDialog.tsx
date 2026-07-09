import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MultiFournisseurInput } from '@/components/inventory/MultiFournisseurInput';
import type { NewArticleDialogProps } from '@/modules/commercial/quotations/hooks/useDevisArticleDialogs';

export type { NewArticleDialogProps };

export function DevisNewArticleDialog({
  open,
  onOpenChange,
  newArticle,
  setNewArticle,
  newArticleFournisseurs,
  setNewArticleFournisseurs,
  newArticleFicheFiles,
  setNewArticleFicheFiles,
  fileInputRef,
  newArticleFicheRef,
  handleArticleImageUpload,
  resetNewArticleForm,
  createNewArticle,
  isCreatingArticle,
  dbCategories,
  sizes,
  colors,
}: NewArticleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un Nouvel Article</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image Upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {newArticle.image ? (
                  <img src={newArticle.image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              {newArticle.image && (
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewArticle((p) => ({ ...p, image: null }));
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleArticleImageUpload}
            />
            <div>
              <p className="text-sm font-medium text-foreground">Image du produit</p>
              <p className="text-xs text-muted-foreground">Cliquez pour télécharger</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom du produit *</Label>
              <Input
                value={newArticle.name}
                onChange={(e) => setNewArticle((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Pantalon de Travail Pro"
              />
            </div>
            <div className="space-y-2">
              <Label>Code Article *</Label>
              <Input
                value={newArticle.sku}
                onChange={(e) => setNewArticle((p) => ({ ...p, sku: e.target.value }))}
                placeholder="Ex: PAN-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select
                value={newArticle.category}
                onValueChange={(val) => setNewArticle((p) => ({ ...p, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {dbCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taille</Label>
              <Input
                list="devis-sizes"
                value={newArticle.size}
                onChange={(e) => setNewArticle((p) => ({ ...p, size: e.target.value }))}
                placeholder="Optionnel"
              />
              <datalist id="devis-sizes">
                {sizes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2 space-y-2">
              <MultiFournisseurInput
                value={newArticleFournisseurs}
                onChange={setNewArticleFournisseurs}
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <Input
                list="devis-colors"
                value={newArticle.color}
                onChange={(e) => setNewArticle((p) => ({ ...p, color: e.target.value }))}
                placeholder="Optionnel"
              />
              <datalist id="devis-colors">
                {colors.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Stock Minimum *</Label>
              <Input
                type="number"
                min="0"
                value={newArticle.min_stock}
                onChange={(e) =>
                  setNewArticle((p) => ({ ...p, min_stock: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>
            {/* Fiche Technique Upload */}
            <div className="col-span-2 space-y-2">
              <Label>Fiches Techniques</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => newArticleFicheRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Ajouter fichier(s)
                </Button>
                <input
                  ref={newArticleFicheRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) setNewArticleFicheFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
                <span className="text-xs text-muted-foreground">Images & PDF (convertis en JPEG)</span>
              </div>
              {newArticleFicheFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {newArticleFicheFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setNewArticleFicheFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetNewArticleForm();
            }}
          >
            Annuler
          </Button>
          <Button onClick={() => void createNewArticle()} disabled={isCreatingArticle}>
            {isCreatingArticle ? 'Création...' : 'Créer et Sélectionner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

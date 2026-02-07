import { useState, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Available gradient colors for categories
const CATEGORY_COLORS = [
  { name: 'Bleu', value: 'from-blue-500 to-blue-600' },
  { name: 'Indigo', value: 'from-indigo-500 to-indigo-600' },
  { name: 'Ambre', value: 'from-amber-500 to-amber-600' },
  { name: 'Violet', value: 'from-purple-500 to-purple-600' },
  { name: 'Émeraude', value: 'from-emerald-500 to-emerald-600' },
  { name: 'Rouge', value: 'from-red-500 to-red-600' },
  { name: 'Orange', value: 'from-orange-500 to-orange-600' },
  { name: 'Teal', value: 'from-teal-500 to-teal-600' },
  { name: 'Sky', value: 'from-sky-600 to-sky-700' },
  { name: 'Rose', value: 'from-rose-500 to-rose-600' },
  { name: 'Cyan', value: 'from-cyan-500 to-cyan-600' },
  { name: 'Lime', value: 'from-lime-500 to-lime-600' },
  { name: 'Pink', value: 'from-pink-500 to-pink-600' },
  { name: 'Gris', value: 'from-zinc-500 to-zinc-600' },
];

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  categoryCount: number;
  currentColor?: string;
  onSave: (newName: string, newColor: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isCustomCategory: boolean;
}

export const CategoryEditModal = ({
  isOpen,
  onClose,
  categoryName,
  categoryCount,
  currentColor,
  onSave,
  onDelete,
  isCustomCategory,
}: CategoryEditModalProps) => {
  const [name, setName] = useState(categoryName);
  const [selectedColor, setSelectedColor] = useState(currentColor || CATEGORY_COLORS[0].value);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(categoryName);
    setSelectedColor(currentColor || CATEGORY_COLORS[0].value);
  }, [categoryName, currentColor, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave(name.trim(), selectedColor);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (categoryCount > 0) {
      // Cannot delete - has products
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = isCustomCategory && categoryCount === 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category-edit-name">Nom de la catégorie</Label>
              <Input
                id="category-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de la catégorie"
              />
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="grid grid-cols-7 gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color.value} transition-all ${
                      selectedColor === color.value 
                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                        : 'hover:scale-105'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className={`bg-gradient-to-br ${selectedColor} rounded-lg p-4 text-white`}>
                <p className="font-semibold">{name || 'Nom de la catégorie'}</p>
                <p className="text-sm text-white/80">{categoryCount} article{categoryCount !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Delete Section - Only for custom categories */}
            {isCustomCategory && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-destructive">Zone dangereuse</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryCount > 0 
                        ? `Impossible de supprimer : ${categoryCount} article${categoryCount !== 1 ? 's' : ''} associé${categoryCount !== 1 ? 's' : ''}`
                        : 'Supprimer définitivement cette catégorie'
                      }
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteClick}
                    disabled={!canDelete || isDeleting}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie "{categoryName}" ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

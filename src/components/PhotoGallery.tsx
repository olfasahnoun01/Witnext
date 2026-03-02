import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Edit,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryItem {
  id: number;
  name: string;
  category: string;
  description: string | null;
  photos: string[];
  created_at: string;
}

const DEFAULT_CATEGORIES = ['Général', 'Produits', 'Projets', 'Installations', 'Autres'];

export const PhotoGallery = () => {
  const { isAdmin, isModerator } = useAuth();
  const { toast } = useToast();
  const canEdit = isAdmin || isModerator;

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<GalleryItem | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState(0);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Général');
  const [formDescription, setFormDescription] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data.map(d => ({
        ...d,
        photos: (d.photos as any) || [],
        description: d.description || null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel('gallery-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchItems]);

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...items.map(i => i.category)])];

  const filtered = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setFormName('');
    setFormCategory('Général');
    setFormDescription('');
    setFormPhotos([]);
  };

  const openAdd = () => {
    resetForm();
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEdit = (item: GalleryItem) => {
    setFormName(item.name);
    setFormCategory(item.category);
    setFormDescription(item.description || '');
    setFormPhotos([...item.photos]);
    setEditingItem(item);
    setShowAddModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('gallery-photos')
        .upload(path, file, { upsert: true });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('gallery-photos')
          .getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
    }

    setFormPhotos(prev => [...prev, ...newUrls]);
    setUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setFormPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom est obligatoire' });
      return;
    }

    setSaving(true);
    const payload = {
      name: formName.trim(),
      category: formCategory,
      description: formDescription.trim() || null,
      photos: formPhotos,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('gallery_items')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Modifié', description: 'Élément mis à jour' });
        setShowAddModal(false);
      }
    } else {
      const { error } = await supabase
        .from('gallery_items')
        .insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });

      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        toast({ title: 'Ajouté', description: 'Élément ajouté à la galerie' });
        setShowAddModal(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (item: GalleryItem) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    const { error } = await supabase.from('gallery_items').delete().eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({ title: 'Supprimé', description: 'Élément supprimé' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucun élément</p>
          <p className="text-sm">
            {items.length === 0 ? 'Ajoutez votre premier élément à la galerie' : 'Aucun résultat pour cette recherche'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200"
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-square bg-muted cursor-pointer overflow-hidden"
                onClick={() => {
                  if (item.photos.length > 0) {
                    setViewingItem(item);
                    setViewingPhotoIndex(0);
                  }
                }}
              >
                {item.photos.length > 0 ? (
                  <img
                    src={item.photos[0]}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                {item.photos.length > 1 && (
                  <Badge className="absolute top-2 right-2 bg-foreground/70 text-background text-xs">
                    {item.photos.length} photos
                  </Badge>
                )}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                  {item.photos.length > 0 && (
                    <Eye className="w-8 h-8 text-background opacity-0 group-hover:opacity-80 transition-opacity" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{item.category}</Badge>
                </div>

                {canEdit && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(item)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Modifier l\'élément' : 'Ajouter un élément'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifiez les informations de cet élément' : 'Ajoutez un nouvel élément à la galerie'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nom de l'élément" />
            </div>

            <div>
              <Label>Catégorie</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Description optionnelle" />
            </div>

            {/* Photos */}
            <div>
              <Label>Photos</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {formPhotos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">Ajouter</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingItem ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-foreground/95">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewingItem?.name}</DialogTitle>
            <DialogDescription>Visualisation des photos</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="relative">
              <div className="flex items-center justify-center min-h-[60vh]">
                <img
                  src={viewingItem.photos[viewingPhotoIndex]}
                  alt={viewingItem.name}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>

              {/* Navigation */}
              {viewingItem.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setViewingPhotoIndex(i => (i - 1 + viewingItem.photos.length) % viewingItem.photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/20 hover:bg-background/40 text-background transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setViewingPhotoIndex(i => (i + 1) % viewingItem.photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/20 hover:bg-background/40 text-background transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-foreground/80 to-transparent">
                <h3 className="text-background font-semibold text-lg">{viewingItem.name}</h3>
                {viewingItem.description && (
                  <p className="text-background/70 text-sm">{viewingItem.description}</p>
                )}
                {viewingItem.photos.length > 1 && (
                  <div className="flex gap-1.5 mt-2">
                    {viewingItem.photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setViewingPhotoIndex(i)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          i === viewingPhotoIndex ? "bg-background w-4" : "bg-background/40"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

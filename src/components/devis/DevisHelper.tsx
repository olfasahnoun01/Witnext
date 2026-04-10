import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, File as FileIcon, X, Check, Loader2, Link as LinkIcon, AlertCircle, Plus, Image as ImageIcon } from 'lucide-react';
import { extractDevisItemsFromPdf } from '@/utils/pdfParser';
import { extractItemsFromImage } from '@/utils/ocrParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductGroupModal } from '@/components/inventory/ProductGroupModal';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ExtractedItem {
  id: string;
  description: string;
  status: 'searching' | 'found' | 'not_found' | 'uploaded' | 'missing_fiche';
  product_id?: number;
  product_name?: string;
  category?: string;
  sku?: string;
  fiche_technique_url?: string | null;
}

interface DevisHelperProps {
  onTabChange?: (tab: string) => void;
}

export const DevisHelper = ({ onTabChange }: DevisHelperProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [extractedDescriptions, setExtractedDescriptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal d'ajout à l'inventaire
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productNameForModal, setProductNameForModal] = useState('');

  // Persistance localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('grosafe_devis_helper_session');
    if (savedSession) {
      try {
        const { items: savedItems, descriptions } = JSON.parse(savedSession);
        if (savedItems) setItems(savedItems);
        if (descriptions) setExtractedDescriptions(descriptions);
      } catch (e) {
        console.error('Error loading devis helper session:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (items.length > 0 || extractedDescriptions.length > 0) {
      localStorage.setItem('grosafe_devis_helper_session', JSON.stringify({
        items,
        descriptions: extractedDescriptions
      }));
    }
  }, [items, extractedDescriptions]);

  const checkMatches = useCallback(async (descriptions: string[]) => {
    setIsProcessing(true);
    try {
      const initialItems: ExtractedItem[] = descriptions.map((desc, idx) => ({
        id: `idx-${idx}`,
        description: desc,
        status: 'searching',
      }));

      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, name, sku, category, fiche_technique_url');

      if (error) throw error;

      const updatedItems = initialItems.map(item => {
        const descLower = item.description.toLowerCase();
        
        let match = dbProducts?.find(p => 
          descLower.includes(p.name.toLowerCase()) || 
          p.name.toLowerCase().includes(descLower) ||
          descLower.includes(p.sku.toLowerCase())
        );

        if (match) {
          return {
            ...item,
            status: match.fiche_technique_url ? 'found' : 'missing_fiche',
            product_id: match.id,
            product_name: match.name,
            category: match.category,
            sku: match.sku,
            fiche_technique_url: match.fiche_technique_url
          } as ExtractedItem;
        }

        return {
          ...item,
          status: 'not_found'
        } as ExtractedItem;
      });

      setItems(updatedItems);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la vérification dans l\'inventaire');
    }
    setIsProcessing(false);
    setOcrProgress(0);
  }, []);

  const handleViewInInventory = (item: ExtractedItem) => {
    if (!onTabChange || !item.category) return;
    
    // Save search info in localStorage for Inventory tab to pick up
    localStorage.setItem('grosafe_inventory_category', item.category);
    if (item.product_name) {
      localStorage.setItem('grosafe_inventory_search', item.product_name);
    }
    
    onTabChange('inventory');
    toast.info(`Navigation vers ${item.category}...`);
  };

  const clearSession = () => {
    setItems([]);
    setExtractedDescriptions([]);
    localStorage.removeItem('grosafe_devis_helper_session');
    toast.success('Session effacée');
  };

  const processFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      toast.error('Veuillez fournir un fichier PDF ou une image valide.');
      return;
    }

    setIsProcessing(true);
    setOcrProgress(0);
    setItems([]);
    setExtractedDescriptions([]);

    try {
      let descriptions: string[] = [];
      
      if (isPdf) {
        descriptions = await extractDevisItemsFromPdf(file);
      } else {
        descriptions = await extractItemsFromImage(file, (p) => setOcrProgress(p));
      }
      
      if (descriptions.length === 0) {
        toast.error("Aucun article n'a pu être extrait. Vérifiez la qualité du document.");
        setIsProcessing(false);
        setOcrProgress(0);
        return;
      }
      
      setExtractedDescriptions(descriptions);
      await checkMatches(descriptions);
      toast.success(`${descriptions.length} article(s) analysé(s) !`);

    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'analyse du document.');
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleProductAdded = () => {
    toast.success('Produit ajouté, on relance la détection...');
    if (extractedDescriptions.length > 0) {
      checkMatches(extractedDescriptions);
    }
  };

  const openAddModal = (description: string) => {
    setProductNameForModal(description);
    setIsAddModalOpen(true);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const uploadFicheTechnique = async (item: ExtractedItem, file: File) => {
    if (!item.product_id) return;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `fiches/${fileName}`;

    toast.loading('Téléversement...', { id: `upload-${item.id}` });

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fiches_techniques')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('fiches_techniques').getPublicUrl(filePath);

      const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
        _product_id: item.product_id,
        _fiche_technique_url: JSON.stringify([data.publicUrl])
      });

      if (rpcError) throw rpcError;

      toast.success('Fiche technique ajoutée !', { id: `upload-${item.id}` });
      
      setItems(prev => prev.map(p => 
        p.id === item.id ? { ...p, status: 'found', fiche_technique_url: JSON.stringify([data.publicUrl]) } : p
      ));

    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du téléversement', { id: `upload-${item.id}` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl shadow-sm border space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Devis Helper</h2>
            <p className="text-muted-foreground text-sm">
              Importez un devis (PDF) ou une photo pour identifier les articles manquants et compléter votre inventaire.
            </p>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSession} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4 mr-2" />
              Effacer session
            </Button>
          )}
        </div>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
          }`}
        >
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          {isProcessing ? (
            <div className="flex flex-col items-center w-full max-w-xs transition-all animate-in fade-in zoom-in duration-300">
              {ocrProgress > 0 ? (
                <>
                  <ImageIcon className="w-10 h-10 text-primary animate-pulse mb-4" />
                  <p className="font-medium text-center mb-2">Lecture de l'image... {Math.round(ocrProgress * 100)}%</p>
                  <Progress value={ocrProgress * 100} className="h-2 w-full" />
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                  <p className="font-medium text-center">Analyse en cours...</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileIcon className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-primary/70'}`} />
                </div>
                <div className="p-3 bg-accent/10 rounded-lg">
                  <ImageIcon className={`w-8 h-8 ${isDragging ? 'text-accent' : 'text-accent/70'}`} />
                </div>
              </div>
              <p className="font-medium text-center">
                Glissez-déposez un PDF ou une Photo ici
              </p>
              <p className="text-sm text-muted-foreground mt-2">ou cliquez pour parcourir</p>
            </>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-card p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-primary" />
              Résultats de l'analyse ({items.length} articles)
            </h3>
            <Button variant="outline" size="sm" onClick={() => checkMatches(extractedDescriptions)} disabled={isProcessing}>
              <Loader2 className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : 'hidden'}`} />
              Rafraîchir
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`p-4 rounded-lg border flex items-center justify-between gap-4 transition-colors ${
                  item.status === 'not_found' ? 'bg-red-500/5 border-red-500/20' :
                  item.status === 'found' ? 'bg-green-500/5 border-green-500/20' :
                  'bg-yellow-500/5 border-yellow-500/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.description}</p>
                  {item.product_name && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        Lié à: {item.product_name}
                      </p>
                      {item.category && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {item.category}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {(item.status === 'found' || item.status === 'missing_fiche') && item.product_id && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1.5"
                      onClick={() => handleViewInInventory(item)}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Voir dans l'inventaire
                    </Button>
                  )}

                  {item.status === 'not_found' && (
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:flex items-center gap-1 text-sm font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded">
                        <X className="w-4 h-4" />
                        Non trouvé
                      </span>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 gap-1"
                        onClick={() => openAddModal(item.description)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter
                      </Button>
                    </div>
                  )}
                  {item.status === 'found' && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded">
                        <Check className="w-4 h-4" />
                        Dispo
                      </span>
                    </div>
                  )}
                  {item.status === 'missing_fiche' && (
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:flex items-center gap-1 text-sm font-medium text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded">
                        <AlertCircle className="w-4 h-4" />
                        Fiche Manquante
                      </span>
                      <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                        Ajouter Fiche
                        <input 
                          type="file" 
                          accept="application/pdf,image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if(e.target.files && e.target.files[0]) {
                              uploadFicheTechnique(item, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal pour ajouter un produit inexistant depuis helper */}
      <ProductGroupModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleProductAdded}
        defaultName={productNameForModal}
      />
    </div>
  );
};

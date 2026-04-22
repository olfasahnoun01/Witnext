import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, File as FileIcon, X, Check, Loader2, Link as LinkIcon, AlertCircle, Plus, Image as ImageIcon, Type, Eye, Download, Pencil, DownloadCloud } from 'lucide-react';
import { extractDevisItemsFromPdf } from '@/utils/pdfParser';
import { extractItemsFromImage } from '@/utils/ocrParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductGroupModal } from '@/components/inventory/ProductGroupModal';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExtractedItem {
  id: string;
  description: string;
  status: 'searching' | 'found' | 'not_found' | 'uploaded' | 'missing_fiche' | 'mapped';
  product_id?: number;
  mapping_id?: string;
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
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [itemToReplace, setItemToReplace] = useState<ExtractedItem | null>(null);

  // Modal d'ajout à l'inventaire
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productNameForModal, setProductNameForModal] = useState('');
  
  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{ url: string, title: string } | null>(null);

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

  const parseUrls = useCallback((urlField: string | null | undefined): string[] => {
    if (!urlField) return [];
    try {
      const parsed = JSON.parse(urlField);
      return Array.isArray(parsed) ? parsed : [urlField];
    } catch {
      return [urlField];
    }
  }, []);

  const checkMatches = useCallback(async (descriptions: string[]) => {
    setIsProcessing(true);
    try {
      // 1. Fetch matching products directly from DB
      const { data: dbProducts, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, category, fiche_technique_url')
        .in('name', descriptions);

      if (prodError) throw prodError;

      // 2. Fetch matching learning translations
      const { data: mappings, error: mapError } = await (supabase
        .from('devis_helper_mappings' as any)
        .select('id, extracted_name, fiche_technique_url')
        .in('extracted_name', descriptions) as any);

      if (mapError) {
        console.warn('Mapping table issues:', mapError);
      }

      const updatedItems: ExtractedItem[] = descriptions.map((desc, idx) => {
        const item: ExtractedItem = {
          id: `idx-${idx}`,
          description: desc,
          status: 'searching',
        };

        // Try to find in DB results
        const productMatch = dbProducts?.find(p => p.name === desc);
        if (productMatch) {
          return {
            ...item,
            status: productMatch.fiche_technique_url ? 'found' : 'missing_fiche',
            product_id: productMatch.id,
            product_name: productMatch.name,
            category: productMatch.category,
            sku: productMatch.sku,
            fiche_technique_url: productMatch.fiche_technique_url
          };
        }

        // Try to find in Mappings results
        const mappingMatch = mappings?.find(m => m.extracted_name === desc);
        if (mappingMatch) {
          return {
            ...item,
            status: 'mapped',
            mapping_id: mappingMatch.id,
            product_name: mappingMatch.extracted_name,
            fiche_technique_url: mappingMatch.fiche_technique_url
          };
        }

        return { ...item, status: 'not_found' };
      });

      setItems(updatedItems);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de synchronisation avec l\'inventaire');
    }
    setIsProcessing(false);
    setOcrProgress(0);
  }, []);

  const handleManualProcess = useCallback(async () => {
    if (!manualText.trim()) {
      toast.error('Veuillez saisir au moins un nom de produit.');
      return;
    }

    const descriptions = manualText
      .split(/[,|\n]/)
      .map(d => d.trim())
      .filter(d => d !== '');

    if (descriptions.length === 0) {
      toast.error('Texte invalide.');
      return;
    }

    setIsProcessing(true);
    setItems([]);
    setExtractedDescriptions(descriptions);
    await checkMatches(descriptions);
    toast.success(`${descriptions.length} article(s) identifié(s) !`);
    setManualText('');
  }, [manualText, checkMatches]);

  const handleProductAdded = useCallback(() => {
    toast.success('Produit ajouté, on relance la détection...');
    if (extractedDescriptions.length > 0) {
      checkMatches(extractedDescriptions);
    }
  }, [extractedDescriptions, checkMatches]);

  const openAddModal = useCallback((description: string) => {
    setProductNameForModal(description);
    setIsAddModalOpen(true);
  }, []);

  const handleViewInInventory = useCallback((item: ExtractedItem) => {
    if (!onTabChange || !item.category) return;
    localStorage.setItem('grosafe_inventory_category', item.category);
    if (item.product_name) {
      localStorage.setItem('grosafe_inventory_search', item.product_name);
    }
    onTabChange('inventory');
    toast.info(`Navigation vers ${item.category}...`);
  }, [onTabChange]);

  const clearSession = useCallback(() => {
    setItems([]);
    setExtractedDescriptions([]);
    localStorage.removeItem('grosafe_devis_helper_session');
    toast.success('Session effacée');
  }, []);

  const uploadFicheTechnique = useCallback(async (item: ExtractedItem, file: File) => {
    // Only PDFs allowed as per user request
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés.');
      return;
    }

    const fileExt = 'pdf';
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `fiches/${fileName}`;

    toast.loading('Téléversement...', { id: `upload-${item.id}` });

    try {
      const { error: uploadError } = await supabase.storage
        .from('fiches-techniques')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      if (item.product_id) {
        // Case: Existing product in inventory
        const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
          _product_id: item.product_id,
          _fiche_technique_url: publicUrl
        });
        if (rpcError) throw rpcError;
        
        setItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'found' as const, fiche_technique_url: publicUrl } : p
        ));
      } else if (item.status === 'not_found' || item.status === 'mapped') {
        // Case: Learning Mode (Mapping)
        const { error: mapError } = await (supabase
          .from('devis_helper_mappings' as any)
          .upsert({
            extracted_name: item.description,
            fiche_technique_url: publicUrl
          }) as any);
        
        if (mapError) throw mapError;

        setItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'mapped' as const, fiche_technique_url: publicUrl } : p
        ));
      }

      toast.success('Fiche technique enregistrée !', { id: `upload-${item.id}` });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du téléversement', { id: `upload-${item.id}` });
    }
  }, []);

  const handleDownloadFiche = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const fileName = url.split('/').pop()?.split('?')[0] || 'fiche_technique';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    }
  }, []);

  const handleBulkDownload = useCallback(async () => {
    const itemsWithFiche = items.filter(item => item.fiche_technique_url);
    if (itemsWithFiche.length === 0) {
      toast.error('Aucune fiche technique disponible à télécharger.');
      return;
    }

    const allUrls = itemsWithFiche.flatMap(item => parseUrls(item.fiche_technique_url));
    toast.info(`Démarrage du téléchargement groupé (${allUrls.length} fichiers)...`);

    for (const url of allUrls) {
      await handleDownloadFiche(url);
      await new Promise(r => setTimeout(r, 600));
    }

    toast.success('Tous les téléchargements ont été lancés !');
  }, [items, parseUrls, handleDownloadFiche]);

  const processFile = useCallback(async (file: File) => {
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
        toast.error("Aucun article n'a pu être extrait.");
        setIsProcessing(false);
        return;
      }
      
      setExtractedDescriptions(descriptions);
      await checkMatches(descriptions);
      toast.success(`${descriptions.length} article(s) analysé(s) !`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'analyse du document.');
      setIsProcessing(false);
    }
  }, [checkMatches]);

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
  }, [processFile]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const [pendingReplaceTrigger, setPendingReplaceTrigger] = useState(false);
  const [activeReplaceItem, setActiveReplaceItem] = useState<ExtractedItem | null>(null);

  // Trigger du sélecteur de fichier après confirmation
  useEffect(() => {
    if (pendingReplaceTrigger && replaceFileInputRef.current) {
      console.log('Effect: Triggering click on file input...');
      replaceFileInputRef.current.click();
      setPendingReplaceTrigger(false);
    }
  }, [pendingReplaceTrigger]);

  const handleConfirmReplace = useCallback(() => {
    console.log('handleConfirmReplace: Setting trigger to true');
    setActiveReplaceItem(itemToReplace);
    setPendingReplaceTrigger(true);
    setItemToReplace(null);
  }, [itemToReplace]);

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl shadow-sm border space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Devis Helper</h2>
            <p className="text-muted-foreground text-sm">
              Importez un devis (PDF) ou une photo pour identifier les articles manquants.
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
                  <p className="font-medium text-center mb-2">Lecture... {Math.round(ocrProgress * 100)}%</p>
                  <Progress value={ocrProgress * 100} className="h-2 w-full" />
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                  <p className="font-medium text-center">Analyse...</p>
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
              <p className="font-medium text-center">Glissez-déposez un PDF ou une Photo ici</p>
              <p className="text-sm text-muted-foreground mt-2">ou cliquez pour parcourir</p>
            </>
          )}
        </div>

        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="relative px-3 text-xs text-muted-foreground bg-card font-medium uppercase tracking-wider">
            Ou saisir manuellement
          </span>
        </div>

        <div className="space-y-3">
          <textarea
            placeholder="Ex: Produit A, Produit B, Produit C..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="w-full min-h-[100px] p-4 rounded-xl border border-border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm"
          />
          <Button 
            className="w-full h-11 gap-2 text-sm font-semibold" 
            onClick={handleManualProcess}
            disabled={isProcessing || !manualText.trim()}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
            Analyser le texte
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-card p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-primary" />
              Résultats de l'analyse ({items.length} articles)
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => checkMatches(extractedDescriptions)} disabled={isProcessing}>
                <Loader2 className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : 'hidden'}`} />
                Rafraîchir
              </Button>
              {items.some(item => item.fiche_technique_url) && (
                <Button variant="outline" size="sm" onClick={handleBulkDownload} className="text-primary hover:bg-primary/5 gap-2">
                  <DownloadCloud className="w-4 h-4" />
                  Tout télécharger
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`p-4 rounded-lg border flex items-center justify-between gap-4 transition-colors ${
                  item.status === 'not_found' ? 'bg-red-500/5 border-red-500/20' :
                  (item.status === 'found' || item.status === 'mapped') ? 'bg-green-500/5 border-green-500/20' :
                  'bg-yellow-500/5 border-yellow-500/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.description}</p>
                  {item.product_name && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">Lié à: {item.product_name}</p>
                      {item.category && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.category}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {(item.status === 'found' || item.status === 'missing_fiche') && item.product_id && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleViewInInventory(item)}>
                      <LinkIcon className="w-3.5 h-3.5" />
                      Voir l'article
                    </Button>
                  )}

                  {item.status === 'not_found' && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-1 rounded uppercase tracking-wider">
                        <X className="w-3 h-3" />
                        N'existe pas
                      </span>
                      <label className="cursor-pointer bg-accent text-accent-foreground hover:bg-accent/90 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                        <LinkIcon className="w-3.5 h-3.5" />
                        Associer PDF
                        <input 
                          type="file" 
                          accept="application/pdf" 
                          className="hidden" 
                          onChange={(e) => {
                            if(e.target.files && e.target.files[0]) {
                              uploadFicheTechnique(item, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      <Button size="sm" variant="outline" className="h-8 gap-1 opacity-50 hover:opacity-100" onClick={() => openAddModal(item.description)}>
                        <Plus className="w-3.5 h-3.5" />
                        Inventaire
                      </Button>
                    </div>
                  )}

                  {(item.status === 'found' || item.status === 'mapped') && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-500/10 px-2 py-1 rounded uppercase tracking-wider">
                        <Check className="w-4 h-4" />
                        {item.status === 'mapped' ? 'Mémoire' : 'Existe'}
                      </span>
                      {item.fiche_technique_url && (
                        <div className="flex items-center gap-1 border-l border-border pl-2 border-dashed ml-1">
                          {parseUrls(item.fiche_technique_url).map((url, i) => (
                            <div key={i} className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10" 
                                onClick={() => {
                                  setSelectedPreviewDoc({ url, title: item.product_name || item.description });
                                  setPreviewOpen(true);
                                }} 
                                title="Voir"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary hover:bg-primary/10" onClick={() => handleDownloadFiche(url)} title="Télécharger">
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-600/10" onClick={() => setItemToReplace(item)} title="Remplacer">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {item.status === 'missing_fiche' && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        Sans Fiche
                      </span>
                      <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                        Ajouter Fiche
                      <input 
                        type="file" 
                        accept="application/pdf" 
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

      <ProductGroupModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={handleProductAdded} defaultName={productNameForModal} />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="truncate pr-8 flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-primary" />
               Aperçu: {selectedPreviewDoc?.title}
            </DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm" 
                className="gap-2 font-bold shadow-lg"
                onClick={() => selectedPreviewDoc && handleDownloadFiche(selectedPreviewDoc.url)}
              >
                <DownloadCloud className="w-4 h-4" />
                TELECHARGER LA FICHE
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 relative">
            {selectedPreviewDoc?.url ? (
              selectedPreviewDoc.url.toLowerCase().endsWith('.pdf') || selectedPreviewDoc.url.includes('/fiches/') ? (
                <iframe 
                  src={`${selectedPreviewDoc.url}#toolbar=0`} 
                  className="w-full h-full border-none"
                  title="Document Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img 
                    src={selectedPreviewDoc.url} 
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
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToReplace} onOpenChange={(open) => !open && setItemToReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer la fiche technique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela va écraser la fiche actuelle pour <strong>{itemToReplace?.product_name || itemToReplace?.description}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace} className="bg-amber-600 hover:bg-amber-700">
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        type="file"
        ref={replaceFileInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={(e) => {
          console.log('Replace input onChange triggered');
          if (e.target.files?.[0] && activeReplaceItem) {
            console.log('File selected:', e.target.files[0].name);
            uploadFicheTechnique(activeReplaceItem, e.target.files[0]);
            setActiveReplaceItem(null);
          } else {
            console.warn('File selection ignored. files:', e.target.files, 'activeReplaceItem:', activeReplaceItem);
          }
        }}
      />
    </div>
  );
};

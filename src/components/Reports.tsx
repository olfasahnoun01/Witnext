import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, Package, History } from 'lucide-react';
import { getAllProducts, getLowStockProducts, createTransaction, getProductById, updateProduct } from '@/services/dbService';
import { Product, DocumentItem } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentType, SavedDocument, generateOfficialPDF } from '@/utils/pdfGenerator';
import { StandardReports } from '@/components/reports/StandardReports';
import { DocumentHistory } from '@/components/reports/DocumentHistory';
import { DocumentForm } from '@/components/reports/DocumentForm';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

export const Reports = () => {
  const { isAdmin, isModerator } = useAuth();
  const canEditDocuments = isAdmin || isModerator;
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [activeSection, setActiveSection] = useState<'reports' | 'documents' | 'history'>('reports');
  
  // Document state
  const [docType, setDocType] = useState<DocumentType>('bon_livraison');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [docValidity, setDocValidity] = useState('');
  const [transportRef, setTransportRef] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyAddress, setThirdPartyAddress] = useState('');
  const [thirdPartyTaxId, setThirdPartyTaxId] = useState('');
  const [docItems, setDocItems] = useState<DocumentItem[]>([]);
  
  // Add item form
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<number>(0);

  // Document history state
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [editingDocument, setEditingDocument] = useState<SavedDocument | null>(null);

  // Ref for debounce
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stock shortage confirmation state
  const [stockShortageItems, setStockShortageItems] = useState<Array<{
    designation: string;
    product_id: number;
    requested: number;
    available: number;
    shortage: number;
  }>>([]);
  const [pendingSaveAfterShortage, setPendingSaveAfterShortage] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [productsData, lowStockData] = await Promise.all([
        getAllProducts(),
        getLowStockProducts()
      ]);
      setProducts(productsData);
      setLowStockProducts(lowStockData);
    };
    loadData();
  }, []);

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSavedDocuments(data.map(doc => {
        let parsedItems: DocumentItem[] = [];
        if (doc.items) {
          if (typeof doc.items === 'string') {
            try {
              parsedItems = JSON.parse(doc.items);
            } catch {
              parsedItems = [];
            }
          } else if (Array.isArray(doc.items)) {
            parsedItems = doc.items as unknown as DocumentItem[];
          }
        }
        return {
          ...doc,
          type: doc.type as 'bon_livraison' | 'bon_sortie' | 'bon_entree',
          items: parsedItems
        };
      }));
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const generateNextDocNumber = useCallback((type: DocumentType) => {
    const prefix = type === 'bon_entree' ? 'BE' : type === 'bon_sortie' ? 'BS' : 'BL';
    
    const docsOfType = savedDocuments.filter(d => d.type === type);
    let maxNumber = 0;
    
    docsOfType.forEach(doc => {
      const match = doc.doc_number.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });
    
    const nextNumber = (maxNumber + 1).toString().padStart(2, '0');
    setDocNumber(`${prefix}-${nextNumber}`);
  }, [savedDocuments]);

  // Auto-generate document number when type changes
  useEffect(() => {
    if (editingDocument) return;
    generateNextDocNumber(docType);
  }, [docType, editingDocument, generateNextDocNumber]);

  // Auto-save when editing (debounced) - using ref for stable reference
  useEffect(() => {
    // Only auto-save if we have a valid editing document with an ID
    if (!editingDocument || !editingDocument.id) return;
    
    // Don't auto-save if items are empty (indicates form is being reset)
    if (docItems.length === 0) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Double-check editingDocument is still valid before saving
      if (!editingDocument || !editingDocument.id) return;
      
      const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
      const totalAmount = showPrice 
        ? docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
        : 0;

      await supabase.from('documents').update({
        type: docType,
        doc_number: docNumber,
        doc_date: docDate,
        validity: docValidity || null,
        transport_ref: transportRef || null,
        third_party_name: thirdPartyName || null,
        third_party_address: thirdPartyAddress || null,
        third_party_tax_id: thirdPartyTaxId || null,
        items: JSON.parse(JSON.stringify(docItems)),
        total_amount: totalAmount
      }).eq('id', editingDocument.id);
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editingDocument?.id, docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems]);

  const resetForm = useCallback(() => {
    setDocType('bon_livraison');
    setDocNumber('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDocValidity('');
    setTransportRef('');
    setThirdPartyName('');
    setThirdPartyAddress('');
    setThirdPartyTaxId('');
    setDocItems([]);
  }, []);

  const [isSaving, setIsSaving] = useState(false);

  // Helper: perform the actual save (insert document + deduct stock)
  const performSave = useCallback(async (forceZeroShortages: boolean = false) => {
    setIsSaving(true);
    try {
      const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
      const totalAmount = showPrice 
        ? docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
        : 0;

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('documents').insert({
        type: docType,
        doc_number: docNumber,
        doc_date: docDate,
        validity: docValidity || null,
        transport_ref: transportRef || null,
        third_party_name: thirdPartyName || null,
        third_party_address: thirdPartyAddress || null,
        third_party_tax_id: thirdPartyTaxId || null,
        items: JSON.parse(JSON.stringify(docItems)),
        total_amount: totalAmount,
        created_by: user?.id
      });

      if (error) {
        toast.error('Erreur lors de la sauvegarde du document');
        console.error(error);
        return;
      }

      // Deduct stock for BL and BS — track actual deducted quantities
      if (docType === 'bon_livraison' || docType === 'bon_sortie') {
        const itemsWithActual = [...docItems];
        for (let i = 0; i < itemsWithActual.length; i++) {
          const item = itemsWithActual[i];
          if (item.product_id) {
            const product = await getProductById(item.product_id);
            if (product) {
              const actualDeducted = Math.min(item.quantity, product.quantity);
              const newQty = product.quantity - actualDeducted;
              await updateProduct(item.product_id, { quantity: newQty });
              // Store actual deducted in item for accurate restoration on delete
              itemsWithActual[i] = { ...item, actual_deducted: actualDeducted };
              await supabase.from('transactions').insert({
                product_id: item.product_id,
                product_name: item.designation,
                type: 'OUT',
                quantity: actualDeducted,
                date: new Date().toISOString(),
                note: `${docType === 'bon_livraison' ? 'Bon de Livraison' : 'Bon de Sortie'} ${docNumber}`
              });
            }
          }
        }
        // Update the saved document items with actual_deducted info
        await supabase.from('documents').update({
          items: JSON.parse(JSON.stringify(itemsWithActual))
        }).eq('doc_number', docNumber);
      }

      toast.success('Document sauvegardé avec succès');
      const savedType = docType;
      resetForm();
      const productsData = await getAllProducts();
      setProducts(productsData);
      await loadDocuments();
      generateNextDocNumber(savedType);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems, loadDocuments, resetForm, generateNextDocNumber]);

  const saveDocument = useCallback(async () => {
    if (isSaving) return;

    if (docItems.length === 0) {
      toast.error('Veuillez ajouter au moins un article avant de sauvegarder');
      return;
    }

    // Check stock shortages for BL and BS
    if (docType === 'bon_livraison' || docType === 'bon_sortie') {
      const shortages: typeof stockShortageItems = [];
      
      for (const item of docItems) {
        if (item.product_id) {
          const product = await getProductById(item.product_id);
          if (product && item.quantity > product.quantity) {
            shortages.push({
              designation: item.designation,
              product_id: item.product_id,
              requested: item.quantity,
              available: product.quantity,
              shortage: item.quantity - product.quantity
            });
          }
        }
      }

      if (shortages.length > 0) {
        setStockShortageItems(shortages);
        setPendingSaveAfterShortage(true);
        return;
      }
    }

    await performSave();
  }, [isSaving, docType, docItems, performSave]);

  // Handle shortage confirmation
  const handleShortageAccept = useCallback(async () => {
    setStockShortageItems([]);
    setPendingSaveAfterShortage(false);
    await performSave(true);
  }, [performSave]);

  const handleShortageReject = useCallback(() => {
    setStockShortageItems([]);
    setPendingSaveAfterShortage(false);
  }, []);

  const updateDocument = useCallback(async () => {
    if (!editingDocument) return;

    // Clear auto-save timeout to prevent race conditions
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Store the document ID before any state changes
    const documentId = editingDocument.id;

    const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
    const totalAmount = showPrice 
      ? docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
      : 0;

    const { error } = await supabase.from('documents').update({
      type: docType,
      doc_number: docNumber,
      doc_date: docDate,
      validity: docValidity || null,
      transport_ref: transportRef || null,
      third_party_name: thirdPartyName || null,
      third_party_address: thirdPartyAddress || null,
      third_party_tax_id: thirdPartyTaxId || null,
      items: JSON.parse(JSON.stringify(docItems)),
      total_amount: totalAmount
    }).eq('id', documentId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error('Update error:', error);
    } else {
      toast.success('Document mis à jour');
      // Reset form BEFORE clearing editing state to prevent auto-save trigger
      // Use a flag to skip auto-save during this transition
      setDocItems([]);
      setDocType('bon_livraison');
      setDocNumber('');
      setDocDate(new Date().toISOString().split('T')[0]);
      setDocValidity('');
      setTransportRef('');
      setThirdPartyName('');
      setThirdPartyAddress('');
      setThirdPartyTaxId('');
      // Clear editing state last
      setEditingDocument(null);
      loadDocuments();
    }
  }, [editingDocument, docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems, loadDocuments]);

  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<SavedDocument | null>(null);

  const deleteDocument = useCallback(async (doc: SavedDocument) => {
    try {
      // For bon_entree: deduct stock before deleting
      if (doc.type === 'bon_entree' && doc.items.length > 0) {
        for (const item of doc.items) {
          if (item.product_id) {
            const result = await createTransaction({
              product_id: item.product_id,
              product_name: item.designation,
              type: 'OUT',
              quantity: item.quantity,
              date: new Date().toISOString(),
              note: `Annulation - Suppression ${doc.doc_number}`
            });
            if (!result.success) {
              toast.error(`Erreur déduction stock pour "${item.designation}": ${result.error}`);
            }
          }
        }
      }

      // For bon_livraison / bon_sortie: restore only actually deducted stock
      if ((doc.type === 'bon_livraison' || doc.type === 'bon_sortie') && doc.items.length > 0) {
        for (const item of doc.items) {
          if (item.product_id) {
            const product = await getProductById(item.product_id);
            if (product) {
              // Use actual_deducted if available, otherwise fall back to quantity
              const qtyToRestore = item.actual_deducted ?? item.quantity;
              const restoredQty = product.quantity + qtyToRestore;
              await updateProduct(item.product_id, { quantity: restoredQty });
              await supabase.from('transactions').insert({
                product_id: item.product_id,
                product_name: item.designation,
                type: 'IN',
                quantity: qtyToRestore,
                date: new Date().toISOString(),
                note: `Restauration - Suppression ${doc.doc_number}`
              });
            }
          }
        }
      }

      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      
      if (error) {
        toast.error('Erreur lors de la suppression');
      } else {
        const stockMsg = (doc.type === 'bon_entree' || doc.type === 'bon_livraison' || doc.type === 'bon_sortie') ? ' et stock ajusté' : '';
        toast.success(`Document supprimé${stockMsg}`);
        const productsData = await getAllProducts();
        setProducts(productsData);
        loadDocuments();
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteConfirmDoc(null);
    }
  }, [loadDocuments]);

  const startEditDocument = useCallback((doc: SavedDocument) => {
    setEditingDocument(doc);
    setDocType(doc.type);
    setDocNumber(doc.doc_number);
    setDocDate(doc.doc_date);
    setDocValidity(doc.validity || '');
    setTransportRef(doc.transport_ref || '');
    setThirdPartyName(doc.third_party_name || '');
    setThirdPartyAddress(doc.third_party_address || '');
    setThirdPartyTaxId(doc.third_party_tax_id || '');
    setDocItems(doc.items);
    setActiveSection('documents');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingDocument(null);
    resetForm();
  }, [resetForm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Section tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveSection('reports')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'reports'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          Rapports Standards
        </button>
        <button
          onClick={() => { setActiveSection('documents'); if (!editingDocument) resetForm(); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'documents'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4" />
          Générateur Documents
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'history'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          Historique Documents
        </button>
      </div>

      {activeSection === 'reports' && (
        <StandardReports products={products} lowStockProducts={lowStockProducts} />
      )}

      {activeSection === 'documents' && (
        <DocumentForm
          docType={docType}
          docNumber={docNumber}
          docDate={docDate}
          docValidity={docValidity}
          transportRef={transportRef}
          thirdPartyName={thirdPartyName}
          thirdPartyAddress={thirdPartyAddress}
          thirdPartyTaxId={thirdPartyTaxId}
          docItems={docItems}
          selectedProductId={selectedProductId}
          itemDescription={itemDescription}
          itemQuantity={itemQuantity}
          itemPrice={itemPrice}
          products={products}
          editingDocument={editingDocument}
          setDocType={setDocType}
          setDocNumber={setDocNumber}
          setDocDate={setDocDate}
          setDocValidity={setDocValidity}
          setTransportRef={setTransportRef}
          setThirdPartyName={setThirdPartyName}
          setThirdPartyAddress={setThirdPartyAddress}
          setThirdPartyTaxId={setThirdPartyTaxId}
          setDocItems={setDocItems}
          setSelectedProductId={setSelectedProductId}
          setItemDescription={setItemDescription}
          setItemQuantity={setItemQuantity}
          setItemPrice={setItemPrice}
          isSaving={isSaving}
          onSave={saveDocument}
          onUpdate={updateDocument}
          onCancel={cancelEdit}
        />
      )}

      {activeSection === 'history' && (
        <DocumentHistory
          savedDocuments={savedDocuments}
          canEdit={canEditDocuments}
          onEdit={startEditDocument}
          onDelete={deleteDocument}
          deleteConfirmDoc={deleteConfirmDoc}
          setDeleteConfirmDoc={setDeleteConfirmDoc}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmDoc} onOpenChange={(open) => !open && setDeleteConfirmDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le document <strong>{deleteConfirmDoc?.doc_number}</strong> ?
              {deleteConfirmDoc?.type === 'bon_entree' && (
                <span className="block mt-2 text-warning font-medium">
                  ⚠️ Les quantités des articles seront automatiquement déduites du stock.
                </span>
              )}
              {(deleteConfirmDoc?.type === 'bon_livraison' || deleteConfirmDoc?.type === 'bon_sortie') && (
                <span className="block mt-2 text-success font-medium">
                  ⚠️ Les quantités des articles seront automatiquement restaurées dans le stock.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmDoc && deleteDocument(deleteConfirmDoc)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock shortage confirmation dialog */}
      <AlertDialog open={stockShortageItems.length > 0} onOpenChange={(open) => !open && handleShortageReject()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Stock insuffisant</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Les articles suivants ont un stock insuffisant :</p>
                <div className="space-y-2 mb-3">
                  {stockShortageItems.map((item, i) => (
                    <div key={i} className="p-2 rounded bg-destructive/10 border border-destructive/20 text-sm">
                      <span className="font-medium text-foreground">{item.designation}</span>
                      <br />
                      <span className="text-muted-foreground">
                        Demandé : <strong>{item.requested}</strong> — Disponible : <strong>{item.available}</strong> — Manque : <strong className="text-destructive">{item.shortage}</strong>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium">Si vous acceptez, le stock de ces articles sera mis à <strong>0</strong>.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleShortageReject}>Refuser</AlertDialogCancel>
            <AlertDialogAction onClick={handleShortageAccept} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Accepter et continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

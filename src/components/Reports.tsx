import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, Package, History } from 'lucide-react';
import { getAllProducts, getLowStockProducts } from '@/services/dbService';
import { Product, DocumentItem } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentType, SavedDocument, generateOfficialPDF } from '@/utils/pdfGenerator';
import { StandardReports } from '@/components/reports/StandardReports';
import { DocumentHistory } from '@/components/reports/DocumentHistory';
import { DocumentForm } from '@/components/reports/DocumentForm';

export const Reports = () => {
  const { isAdmin } = useAuth();
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

  const saveDocument = useCallback(async () => {
    const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
    const totalAmount = showPrice 
      ? docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
      : 0;

    // Get current user for document ownership
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
    } else {
      toast.success('Document sauvegardé avec succès');
      loadDocuments();
    }
  }, [docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems, loadDocuments]);

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

  const deleteDocument = useCallback(async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document?')) return;

    const { error } = await supabase.from('documents').delete().eq('id', id);
    
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Document supprimé');
      loadDocuments();
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
          onSave={saveDocument}
          onUpdate={updateDocument}
          onCancel={cancelEdit}
        />
      )}

      {activeSection === 'history' && (
        <DocumentHistory
          savedDocuments={savedDocuments}
          isAdmin={isAdmin}
          onEdit={startEditDocument}
          onDelete={deleteDocument}
        />
      )}
    </div>
  );
};

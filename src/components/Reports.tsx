import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Package,
  Edit,
  History,
  Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAllProducts, getLowStockProducts } from '@/services/dbService';
import { Product, DocumentData, DocumentItem } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import grosafeLogo from '@/assets/grosafe-logo.png';

interface SavedDocument {
  id: number;
  type: 'bon_livraison' | 'bon_sortie' | 'bon_entree';
  doc_number: string;
  doc_date: string;
  validity: string | null;
  transport_ref: string | null;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  items: DocumentItem[];
  total_amount: number;
  created_at: string;
}

// Convert image to base64 for PDF embedding
const getLogoBase64 = (): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = grosafeLogo;
  });
};
type DocumentType = 'bon_livraison' | 'bon_sortie' | 'bon_entree';

const documentTypes: { value: DocumentType; label: string; color: string }[] = [
  { value: 'bon_livraison', label: 'Bon de Livraison', color: 'destructive' },
  { value: 'bon_sortie', label: 'Bon de Sortie', color: 'destructive' },
  { value: 'bon_entree', label: "Bon d'Entrée", color: 'success' }
];

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

  useEffect(() => {
    loadDocuments();
  }, []);

  // Auto-generate document number when type changes
  useEffect(() => {
    if (editingDocument) return; // Don't auto-generate when editing
    generateNextDocNumber(docType);
  }, [docType, savedDocuments, editingDocument]);

  const generateNextDocNumber = (type: DocumentType) => {
    const prefix = type === 'bon_entree' ? 'BE' : type === 'bon_sortie' ? 'BS' : 'BL';
    
    // Find all documents of this type and extract their numbers
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
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSavedDocuments(data.map(doc => {
        // Ensure items is always a proper array
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
  };

  const saveDocument = async () => {
    const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
    const totalAmount = showPrice 
      ? docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
      : 0;

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
      total_amount: totalAmount
    });

    if (error) {
      toast.error('Erreur lors de la sauvegarde du document');
      console.error(error);
    } else {
      toast.success('Document sauvegardé avec succès');
      loadDocuments();
    }
  };

  const deleteDocument = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document?')) return;

    const { error } = await supabase.from('documents').delete().eq('id', id);
    
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Document supprimé');
      loadDocuments();
    }
  };

  const startEditDocument = (doc: SavedDocument) => {
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
  };

  const updateDocument = async () => {
    if (!editingDocument) return;

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
    }).eq('id', editingDocument.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Document mis à jour');
      setEditingDocument(null);
      resetForm();
      loadDocuments();
    }
  };

  const resetForm = () => {
    setDocType('bon_livraison');
    setDocNumber('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setDocValidity('');
    setTransportRef('');
    setThirdPartyName('');
    setThirdPartyAddress('');
    setThirdPartyTaxId('');
    setDocItems([]);
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    resetForm();
  };

  const isEntree = docType === 'bon_entree';
  const thirdPartyLabel = isEntree ? 'Fournisseur' : 'Client';

  const generateInventoryPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Liste Inventaire', 14, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-TN')}`, 14, 40);
    
    const tableData = products.map(p => [
      p.sku,
      p.name,
      p.category,
      p.size,
      p.fournisseur,
      p.quantity.toString(),
      `${p.price.toFixed(3)} TND`,
      `${(p.price * p.quantity).toFixed(3)} TND`
    ]);
    
    autoTable(doc, {
      startY: 48,
      head: [['Code', 'Désignation', 'Catégorie', 'Taille', 'Fournisseur', 'Qté', 'Prix Unit.', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });
    
    const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 48;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Valeur Totale: ${totalValue.toFixed(3)} TND`, 14, finalY + 10);
    
    doc.save('inventaire_grosafe.pdf');
  };

  const generateLowStockPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38);
    doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Rapport Stock Faible / Rupture', 14, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-TN')}`, 14, 40);
    
    if (lowStockProducts.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94);
      doc.text('Aucun produit en stock faible ou en rupture!', 14, 55);
    } else {
      const tableData = lowStockProducts.map(p => [
        p.sku,
        p.name,
        p.fournisseur,
        p.quantity.toString(),
        p.min_stock.toString(),
        p.quantity === 0 ? 'RUPTURE' : 'FAIBLE'
      ]);
      
      autoTable(doc, {
        startY: 48,
        head: [['Code', 'Désignation', 'Fournisseur', 'Stock', 'Minimum', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 },
        bodyStyles: {
          cellPadding: 3
        },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            if (data.cell.text[0] === 'RUPTURE') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [234, 179, 8];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    }
    
    doc.save('stock_faible_grosafe.pdf');
  };

  const addDocItem = () => {
    if (!selectedProductId) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    
    const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
    
    setDocItems(prev => [...prev, {
      ref: product.sku,
      designation: product.name,
      description: itemDescription,
      quantity: itemQuantity,
      ...(showPrice && { price: itemPrice || product.price })
    }]);
    
    setSelectedProductId('');
    setItemDescription('');
    setItemQuantity(1);
    setItemPrice(0);
  };

  const removeDocItem = (index: number) => {
    setDocItems(prev => prev.filter((_, i) => i !== index));
  };

  const generateOfficialPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Get logo base64
    const logoBase64 = await getLogoBase64();
    
    // Add logo
    doc.addImage(logoBase64, 'PNG', 14, 8, 40, 20);
    
    // Company name next to logo
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95); // Navy blue
    doc.text('GROSAFE ÉQUIPEMENT', 60, 20);
    
    // Horizontal line under header
    doc.setDrawColor(199, 62, 62); // Red accent
    doc.setLineWidth(1);
    doc.line(14, 32, pageWidth - 14, 32);
    
    // Document type title
    const typeInfo = documentTypes.find(t => t.value === docType)!;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(typeInfo.label.toUpperCase(), pageWidth / 2, 45, { align: 'center' });
    
    // Document number and date box (right side)
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.roundedRect(pageWidth - 75, 52, 61, 22, 2, 2);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`N° : ${docNumber || '______'}`, pageWidth - 72, 60);
    doc.text(`Date : ${new Date(docDate).toLocaleDateString('fr-FR')}`, pageWidth - 72, 68);
    
    // Validity info
    if (docValidity) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Ce bon de commande est valable jusqu'au ${docValidity}`, 14, 58);
    }
    
    // Third party section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(thirdPartyLabel, 14, 82);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Raison sociale : ${thirdPartyName || '________________________'}`, 14, 90);
    doc.text(`Adresse de livraison : ${thirdPartyAddress || '________________________'}`, 14, 98);
    doc.text(`Identification Fiscale : ${thirdPartyTaxId || '________________________'}`, 14, 106);
    
    // Delivery details section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Détails de la livraison', 14, 120);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Immatriculation voiture : ${transportRef || '________________________'}`, 14, 128);
    
    // Items table - with price for Bon de Livraison and Bon de Sortie
    const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
    
    const tableData = docItems.map((item, index) => {
      const baseRow = [
        (index + 1).toString(),
        item.designation,
        item.description,
        item.quantity.toString()
      ];
      if (showPrice) {
        const price = item.price || 0;
        const total = price * item.quantity;
        baseRow.push(`${price.toFixed(3)} TND`, `${total.toFixed(3)} TND`);
      }
      return baseRow;
    });
    
    const tableHead = showPrice 
      ? [['Réf', 'Désignation', 'Description', 'Qté', 'Prix Unit.', 'Total']]
      : [['Référence', 'Désignation', 'Description', 'Quantité']];
    
    const emptyRow = showPrice ? ['', '', '', '', '', ''] : ['', '', '', ''];
    
    autoTable(doc, {
      startY: 135,
      head: tableHead,
      body: tableData.length > 0 ? tableData : [emptyRow],
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 58, 95],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: showPrice ? {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 45 },
        2: { cellWidth: 50 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' }
      } : {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 75 },
        3: { cellWidth: 25, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      }
    });
    
    // Add total for documents with price
    if (showPrice && docItems.length > 0) {
      const grandTotal = docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
      const tableY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 95);
      doc.text(`Total Général : ${grandTotal.toFixed(3)} TND`, pageWidth - 14, tableY + 8, { align: 'right' });
    }
    
    // Signature boxes
    const finalY = Math.max((doc as any).lastAutoTable?.finalY || 150, 180);
    
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, finalY + 15, 80, 30, 2, 2);
    doc.roundedRect(pageWidth - 94, finalY + 15, 80, 30, 2, 2);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Signature et cachet Grosafe équipement', 16, finalY + 23);
    doc.text(`Signature et cachet ${thirdPartyLabel}`, pageWidth - 92, finalY + 23);
    
    // Footer section
    const footerY = pageHeight - 25;
    
    // Footer divider
    doc.setDrawColor(199, 62, 62);
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    
    // Company info in footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Société Grosafe Equipment', 14, footerY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Adresse : Immeuble Salma Dar Fadhal Aouina, Tunis', 14, footerY + 5);
    doc.text('Email : contact@grosafe.net', 14, footerY + 10);
    doc.text('Tel : +216 22219219 ; +216 27277777', pageWidth / 2, footerY + 10, { align: 'center' });
    doc.text('Code TVA : 1752965/M/A/M', pageWidth - 14, footerY + 10, { align: 'right' });
    
    const fileName = `${docType}_${docNumber || 'nouveau'}_${docDate}.pdf`;
    doc.save(fileName);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inventory Report */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Liste Inventaire Complet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Génère un rapport PDF contenant tous les produits avec leurs quantités et valeurs.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {products.length} produits • Valeur: {products.reduce((s, p) => s + p.price * p.quantity, 0).toFixed(3)} TND
                </p>
                <Button onClick={generateInventoryPDF} className="mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Low Stock Report */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Rapport Stock Faible</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Liste tous les produits en rupture ou avec un stock inférieur au minimum.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {lowStockProducts.length} produits nécessitent attention
                </p>
                <Button onClick={generateLowStockPDF} variant="outline" className="mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Form */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingDocument ? 'Modifier Document' : 'Nouveau Document'}
              </h3>
              {editingDocument && (
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  Annuler
                </Button>
              )}
            </div>

            {/* Document Type */}
            <div>
              <label className="form-label">Type de Document</label>
              <div className="grid grid-cols-3 gap-2">
                {documentTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setDocType(type.value)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      docType === type.value
                        ? type.color === 'success'
                          ? 'border-success bg-success/10 text-success'
                          : 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Numéro Document</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="form-input"
                  placeholder="Ex: BL-2024-001"
                />
              </div>
              <div>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Validité</label>
                <input
                  type="text"
                  value={docValidity}
                  onChange={(e) => setDocValidity(e.target.value)}
                  className="form-input"
                  placeholder="Ex: 30 jours"
                />
              </div>
              <div>
                <label className="form-label">Réf. Transport</label>
                <input
                  type="text"
                  value={transportRef}
                  onChange={(e) => setTransportRef(e.target.value)}
                  className="form-input"
                  placeholder="Ex: TUN-1234"
                />
              </div>
            </div>

            {/* Third Party Info */}
            <div className={`p-4 rounded-xl ${isEntree ? 'bg-success/5 border border-success/20' : 'bg-destructive/5 border border-destructive/20'}`}>
              <h4 className={`font-medium mb-3 ${isEntree ? 'text-success' : 'text-destructive'}`}>
                {thirdPartyLabel}
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  className="form-input"
                  placeholder="Raison sociale"
                />
                <input
                  type="text"
                  value={thirdPartyAddress}
                  onChange={(e) => setThirdPartyAddress(e.target.value)}
                  className="form-input"
                  placeholder="Adresse"
                />
                <input
                  type="text"
                  value={thirdPartyTaxId}
                  onChange={(e) => setThirdPartyTaxId(e.target.value)}
                  className="form-input"
                  placeholder="Identification Fiscale"
                />
              </div>
            </div>

            {/* Add Items */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Ajouter Article</h4>
              <div className="space-y-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : '')}
                  className="form-input"
                >
                  <option value="">Sélectionner un produit...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="form-input"
                  placeholder="Description (optionnel)"
                />
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="form-input w-24"
                    placeholder="Qté"
                  />
                  {(docType === 'bon_livraison' || docType === 'bon_sortie') && (
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={itemPrice || ''}
                      onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)}
                      className="form-input w-32"
                      placeholder="Prix TND"
                    />
                  )}
                  <Button onClick={addDocItem} disabled={!selectedProductId}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={generateOfficialPDF} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Générer PDF
              </Button>
              {editingDocument ? (
                <Button onClick={updateDocument} variant="secondary" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Mettre à jour
                </Button>
              ) : (
                <Button onClick={saveDocument} variant="secondary" className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Sauvegarder
                </Button>
              )}
            </div>
          </div>

          {/* Preview / Items List */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Articles du Document</h3>
            
            {docItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Aucun article ajouté. Utilisez le formulaire pour ajouter des articles.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {docItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.designation}</p>
                      <p className="text-sm text-muted-foreground">
                        Réf: {item.ref} • Qté: {item.quantity}
                        {item.price !== undefined && ` • ${item.price.toFixed(3)} TND`}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeDocItem(index)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'history' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Historique des Documents</h3>
          
          {savedDocuments.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Aucun document dans l'historique.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N°</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client/Fournisseur</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Articles</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedDocuments.map(doc => {
                    const typeInfo = documentTypes.find(t => t.value === doc.type);
                    return (
                      <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            doc.type === 'bon_entree' 
                              ? 'bg-success/10 text-success' 
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {typeInfo?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">{doc.doc_number}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(doc.doc_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{doc.third_party_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{doc.items.length} articles</td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {doc.total_amount > 0 ? `${doc.total_amount.toFixed(3)} TND` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => startEditDocument(doc)}
                                  className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteDocument(doc.id)}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

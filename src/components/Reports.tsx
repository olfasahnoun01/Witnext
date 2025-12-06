import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Package
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAllProducts, getLowStockProducts } from '@/services/dbService';
import { Product, DocumentData, DocumentItem } from '@/types';
import { Button } from '@/components/ui/button';
import grosafeLogo from '@/assets/grosafe-logo.png';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSection, setActiveSection] = useState<'reports' | 'documents'>('reports');
  
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

  useEffect(() => {
    setProducts(getAllProducts());
  }, []);

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
    const lowStockProducts = getLowStockProducts();
    
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
    
    setDocItems(prev => [...prev, {
      ref: product.sku,
      designation: product.name,
      description: itemDescription,
      quantity: itemQuantity
    }]);
    
    setSelectedProductId('');
    setItemDescription('');
    setItemQuantity(1);
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
    
    // Items table
    const tableData = docItems.map((item, index) => [
      (index + 1).toString(),
      item.designation,
      item.description,
      item.quantity.toString()
    ]);
    
    autoTable(doc, {
      startY: 135,
      head: [['Référence', 'Désignation', 'Description', 'Quantité']],
      body: tableData.length > 0 ? tableData : [['', '', '', '']],
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
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 75 },
        3: { cellWidth: 25, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      }
    });
    
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
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
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
          onClick={() => setActiveSection('documents')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeSection === 'documents'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4" />
          Générateur Documents
        </button>
      </div>

      {activeSection === 'reports' ? (
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
                  {getLowStockProducts().length} produits nécessitent attention
                </p>
                <Button onClick={generateLowStockPDF} variant="outline" className="mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Form */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Informations Document</h3>

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
                  placeholder={`Nom ${thirdPartyLabel}`}
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
                  placeholder="Matricule Fiscale"
                />
              </div>
            </div>
          </div>

          {/* Items Builder */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Articles du Document</h3>

            {/* Add Item Form */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-3">
              <div>
                <label className="form-label">Produit</label>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="form-input"
                    placeholder="Ex: 20 Tailles 40, 10 Tailles L"
                  />
                </div>
                <div>
                  <label className="form-label">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="form-input"
                  />
                </div>
              </div>
              <Button onClick={addDocItem} disabled={!selectedProductId} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter Article
              </Button>
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {docItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun article ajouté
                </p>
              ) : (
                docItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.designation}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.ref} • {item.description || 'Pas de description'} • Qté: {item.quantity}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDocItem(index)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <Button 
              onClick={generateOfficialPDF} 
              className={`w-full ${isEntree ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}`}
              disabled={docItems.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Générer {documentTypes.find(t => t.value === docType)?.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

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

  const generateOfficialPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
    
    // Document type box
    const typeInfo = documentTypes.find(t => t.value === docType)!;
    const boxColor = isEntree ? [34, 197, 94] : [220, 38, 38];
    
    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2]);
    doc.roundedRect(pageWidth - 80, 45, 70, 25, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(typeInfo.label.toUpperCase(), pageWidth - 75, 55);
    doc.setFontSize(12);
    doc.text(`N° ${docNumber || '____'}`, pageWidth - 75, 64);
    
    // Third party box
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, 45, 90, 40, 3, 3);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(thirdPartyLabel.toUpperCase(), 18, 53);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(thirdPartyName || '________________________', 18, 62);
    doc.setFontSize(9);
    doc.text(thirdPartyAddress || '________________________', 18, 70);
    doc.text(`MF: ${thirdPartyTaxId || '____________'}`, 18, 78);
    
    // Info row
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${docDate}`, 14, 95);
    doc.text(`Validité: ${docValidity || '______'}`, 70, 95);
    doc.text(`Transport: ${transportRef || '______'}`, 130, 95);
    
    // Items table
    const tableData = docItems.map(item => [
      item.ref,
      item.designation,
      item.description,
      item.quantity.toString()
    ]);
    
    autoTable(doc, {
      startY: 105,
      head: [['Réf.', 'Désignation', 'Description', 'Quantité']],
      body: tableData.length > 0 ? tableData : [['', '', '', '']],
      theme: 'grid',
      headStyles: { 
        fillColor: isEntree ? [34, 197, 94] : [220, 38, 38],
        fontSize: 10
      },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 50 },
        2: { cellWidth: 80 },
        3: { cellWidth: 25, halign: 'center' }
      }
    });
    
    // Signature boxes
    const finalY = Math.max((doc as any).lastAutoTable?.finalY || 150, 200);
    
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(14, finalY + 10, 80, 35, 3, 3);
    doc.roundedRect(pageWidth - 94, finalY + 10, 80, 35, 3, 3);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Signature GROSAFE', 20, finalY + 20);
    doc.text(`Signature ${thirdPartyLabel}`, pageWidth - 88, finalY + 20);
    
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

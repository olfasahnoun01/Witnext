import { memo, useCallback, useState } from 'react';
import { Plus, Trash2, Download, Edit, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product, DocumentItem } from '@/types';
import { DocumentType, documentTypes, generateOfficialPDF, SavedDocument } from '@/utils/pdfGenerator';
import { CategoryProductSelector } from '@/components/shared/CategoryProductSelector';

interface DocumentFormProps {
  // Document state
  docType: DocumentType;
  docNumber: string;
  docDate: string;
  docValidity: string;
  transportRef: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  docItems: DocumentItem[];
  
  // Form state
  selectedProductId: number | '';
  itemDescription: string;
  itemQuantity: number;
  itemPrice: number;
  
  // Data
  products: Product[];
  editingDocument: SavedDocument | null;
  
  // Handlers
  setDocType: (type: DocumentType) => void;
  setDocNumber: (value: string) => void;
  setDocDate: (value: string) => void;
  setDocValidity: (value: string) => void;
  setTransportRef: (value: string) => void;
  setThirdPartyName: (value: string) => void;
  setThirdPartyAddress: (value: string) => void;
  setThirdPartyTaxId: (value: string) => void;
  setDocItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  setSelectedProductId: (value: number | '') => void;
  setItemDescription: (value: string) => void;
  setItemQuantity: (value: number) => void;
  setItemPrice: (value: number) => void;
  
  onSave: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

// Helper component to display selected product
const SelectedProductDisplay = ({ product, onClear }: { product?: Product; onClear: () => void }) => {
  if (!product) return null;
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {product.sku}
          {product.size && ` • ${product.size}`}
          {product.color && ` • ${product.color}`}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="flex-shrink-0 h-8 w-8 p-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

export const DocumentForm = memo(({
  docType, docNumber, docDate, docValidity, transportRef,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems,
  selectedProductId, itemDescription, itemQuantity, itemPrice,
  products, editingDocument,
  setDocType, setDocNumber, setDocDate, setDocValidity, setTransportRef,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setDocItems,
  setSelectedProductId, setItemDescription, setItemQuantity, setItemPrice,
  onSave, onUpdate, onCancel
}: DocumentFormProps) => {
  
  const isEntree = docType === 'bon_entree';
  const thirdPartyLabel = isEntree ? 'Fournisseur' : 'Client';
  const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';

  const addDocItem = useCallback(() => {
    if (!selectedProductId) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    
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
  }, [selectedProductId, products, itemDescription, itemQuantity, itemPrice, showPrice, setDocItems, setSelectedProductId, setItemDescription, setItemQuantity, setItemPrice]);

  const removeDocItem = useCallback((index: number) => {
    setDocItems(prev => prev.filter((_, i) => i !== index));
  }, [setDocItems]);

  const handleGeneratePDF = useCallback(async () => {
    await generateOfficialPDF({
      docType, docNumber, docDate, docValidity, transportRef,
      thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems
    });
  }, [docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Document Form */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {editingDocument ? 'Modifier Document' : 'Nouveau Document'}
          </h3>
          {editingDocument && (
            <Button variant="outline" size="sm" onClick={onCancel}>
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
            {selectedProductId ? (
              <SelectedProductDisplay
                product={products.find(p => p.id === selectedProductId)}
                onClear={() => setSelectedProductId('')}
              />
            ) : (
              <CategoryProductSelector
                selectedProductId={selectedProductId}
                onSelect={(product) => {
                  setSelectedProductId(product.id);
                  // Pre-fill price if available
                  if (showPrice && product.price) {
                    setItemPrice(product.price);
                  }
                }}
              />
            )}
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
              {showPrice && (
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
          <Button onClick={handleGeneratePDF} className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Générer PDF
          </Button>
          {editingDocument ? (
            <Button onClick={onUpdate} variant="secondary" className="flex-1">
              <Edit className="w-4 h-4 mr-2" />
              Mettre à jour
            </Button>
          ) : (
            <Button onClick={onSave} variant="secondary" className="flex-1">
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
  );
});

DocumentForm.displayName = 'DocumentForm';

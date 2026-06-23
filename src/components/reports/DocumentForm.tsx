import { memo, useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Edit, Package, X, Building2, Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product, DocumentItem } from '@/types';
import { DocumentType, documentTypes, generateOfficialPDF, SavedDocument } from '@/utils/pdfGenerator';
import { CategoryProductSelector } from '@/components/shared/CategoryProductSelector';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DecimalInput } from '@/components/ui/decimal-input';
import { LazyProductImage } from '@/components/shared/LazyProductImage';

interface Fournisseur {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
}

interface Client {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
}

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
  
  isSaving?: boolean;
  onSave: () => void;
  onUpdate: () => void;
  onCancel: () => void;
}

// Helper component to display selected product
const SelectedProductDisplay = ({ product, onClear }: { product?: Product; onClear: () => void }) => {
  if (!product) return null;
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
      <LazyProductImage
        productId={product.id}
        alt={product.name}
        className="w-10 h-10 rounded-lg flex-shrink-0"
      />
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
  onSave, onUpdate, onCancel, isSaving = false
}: DocumentFormProps) => {
  
  const isEntree = docType === 'bon_entree';
  const thirdPartyLabel = isEntree ? 'Fournisseur' : 'Client';
  const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';

  // Inline editing state for document items
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editItemQuantity, setEditItemQuantity] = useState(1);
  const [editItemPrice, setEditItemPrice] = useState(0);
  const [editItemDescription, setEditItemDescription] = useState('');

  const startEditItem = useCallback((index: number) => {
    const item = docItems[index];
    setEditingItemIndex(index);
    setEditItemQuantity(item.quantity);
    setEditItemPrice(item.price ?? 0);
    setEditItemDescription(item.description || '');
  }, [docItems]);

  const saveEditItem = useCallback(() => {
    if (editingItemIndex === null) return;
    setDocItems(prev => prev.map((item, i) => 
      i === editingItemIndex
        ? { ...item, quantity: editItemQuantity, price: showPrice ? editItemPrice : item.price, description: editItemDescription }
        : item
    ));
    setEditingItemIndex(null);
  }, [editingItemIndex, editItemQuantity, editItemPrice, editItemDescription, showPrice, setDocItems]);

  const cancelEditItem = useCallback(() => {
    setEditingItemIndex(null);
  }, []);

  // State for fournisseurs and clients
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>('');

  // Load fournisseurs and clients
  useEffect(() => {
    const loadThirdParties = async () => {
      const [fournisseursRes, clientsRes] = await Promise.all([
        supabase.from('fournisseurs').select('id, nom, matricule_fiscale, location').order('nom'),
        supabase.from('clients').select('id, nom, matricule_fiscale, location').order('nom')
      ]);
      
      if (fournisseursRes.data) setFournisseurs(fournisseursRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    };
    loadThirdParties();
  }, []);

  // Handle third party selection
  const handleThirdPartySelect = useCallback((id: string) => {
    setSelectedThirdPartyId(id);
    
    if (id === 'manual') {
      // Reset to manual entry
      setThirdPartyName('');
      setThirdPartyAddress('');
      setThirdPartyTaxId('');
      return;
    }

    const list = isEntree ? fournisseurs : clients;
    const selected = list.find(item => item.id.toString() === id);
    
    if (selected) {
      setThirdPartyName(selected.nom);
      setThirdPartyAddress(selected.location || '');
      setThirdPartyTaxId(selected.matricule_fiscale || '');
    }
  }, [isEntree, fournisseurs, clients, setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId]);

  // Reset selection when doc type changes
  useEffect(() => {
    setSelectedThirdPartyId('');
  }, [docType]);

  const addDocItem = useCallback(() => {
    if (!selectedProductId) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    
    
    // Price is optional - only include if provided or if showPrice is true and product has price
    const itemData: DocumentItem = {
      line_id: Math.random().toString(36).substring(7),
      ref: product.sku,
      designation: product.name,
      description: itemDescription,
      quantity: itemQuantity,
      product_id: product.id,
    };
    
    // Only add price if it's a document type that shows price (0 is allowed as explicit value)
    if (showPrice) {
      itemData.price = itemPrice;
    }
    
    setDocItems(prev => [...prev, itemData]);
    
    setSelectedProductId('');
    setItemDescription('');
    setItemQuantity(1);
    setItemPrice(0);
  }, [selectedProductId, products, itemDescription, itemQuantity, itemPrice, showPrice, docType, docItems, setDocItems, setSelectedProductId, setItemDescription, setItemQuantity, setItemPrice]);

  const removeDocItem = useCallback((index: number) => {
    setDocItems(prev => prev.filter((_, i) => i !== index));
  }, [setDocItems]);

  const handleGeneratePDF = useCallback(async () => {
    await generateOfficialPDF({
      docType, docNumber, docDate, docValidity, transportRef,
      thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems
    });
  }, [docType, docNumber, docDate, docValidity, transportRef, thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems]);

  const thirdPartyList = isEntree ? fournisseurs : clients;
  const ThirdPartyIcon = isEntree ? Building2 : Users;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-12rem)]">
      {/* Document Form */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-6 lg:overflow-y-auto">
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
          <h4 className={`font-medium mb-3 flex items-center gap-2 ${isEntree ? 'text-success' : 'text-destructive'}`}>
            <ThirdPartyIcon className="w-4 h-4" />
            {thirdPartyLabel}
          </h4>
          <div className="space-y-3">
            {/* Dropdown to select from saved fournisseurs/clients */}
            <Select value={selectedThirdPartyId} onValueChange={handleThirdPartySelect}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder={`Sélectionner un ${thirdPartyLabel.toLowerCase()} existant...`} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="manual">
                  <span className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Saisie manuelle
                  </span>
                </SelectItem>
                {thirdPartyList.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    <span className="flex flex-col">
                      <span className="font-medium">{item.nom}</span>
                      {item.matricule_fiscale && (
                        <span className="text-xs text-muted-foreground">{item.matricule_fiscale}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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
                <DecimalInput
                  value={itemPrice ?? 0}
                  onValueChange={setItemPrice}
                  className="form-input w-32"
                  placeholder="Prix TND (optionnel)"
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
            <Button onClick={onSave} variant="secondary" className="flex-1" disabled={isSaving}>
              <Plus className="w-4 h-4 mr-2" />
              {isSaving ? 'Sauvegarde en cours...' : 'Sauvegarder'}
            </Button>
          )}
        </div>
      </div>

      {/* Preview / Items List */}
      <div className="bg-card rounded-xl border border-border p-6 lg:overflow-y-auto">
        <h3 className="text-lg font-semibold text-foreground mb-4 sticky top-0 bg-card z-10 pb-2">Articles du Document</h3>
        
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
                className="p-4 rounded-lg bg-muted/50"
              >
                {editingItemIndex === index ? (
                  <div className="space-y-3">
                    <p className="font-medium text-foreground">{item.designation}</p>
                    <p className="text-xs text-muted-foreground">Réf: {item.ref}</p>
                    <div className="flex gap-2 flex-wrap items-end">
                      <div>
                        <label className="text-xs text-muted-foreground">Quantité</label>
                        <input
                          type="number"
                          min="1"
                          value={editItemQuantity}
                          onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 1)}
                          className="form-input w-24"
                        />
                      </div>
                      {showPrice && (
                        <div>
                          <label className="text-xs text-muted-foreground">Prix TND</label>
                          <DecimalInput
                            value={editItemPrice ?? 0}
                            onValueChange={setEditItemPrice}
                            className="form-input w-32"
                          />
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editItemDescription}
                      onChange={(e) => setEditItemDescription(e.target.value)}
                      className="form-input"
                      placeholder="Description (optionnel)"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditItem}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditItem}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.designation}</p>
                      <p className="text-sm text-muted-foreground">
                        Réf: {item.ref} • Qté: {item.quantity}
                        {item.price !== undefined && (item.price > 0 ? ` • ${item.price.toFixed(3)} TND` : ' • -')}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditItem(index)}
                        className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeDocItem(index)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

DocumentForm.displayName = 'DocumentForm';

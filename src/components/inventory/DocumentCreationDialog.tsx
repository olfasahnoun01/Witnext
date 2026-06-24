import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Trash2, FileText, Download, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product, UnifiedDocumentType } from '@/types';
import { documentService } from '@/services/documentService';
import { toast } from 'sonner';
import { CategoryProductSelector } from '../shared/CategoryProductSelector';
import { downloadUnifiedDocumentPDF } from '@/utils/pdfGenerator';
import { PendingWarehouseDocument, clearPendingWarehouseDocument, readPendingWarehouseDocument } from '@/lib/appNavigationStorage';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';

interface DocumentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: UnifiedDocumentType;
  onSuccess: () => void;
  initialData?: PendingWarehouseDocument | null;
  mandatory?: boolean;
}

export const DocumentCreationDialog = ({
  open,
  onOpenChange,
  type,
  onSuccess,
  initialData = null,
  mandatory = false,
}: DocumentCreationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [validity, setValidity] = useState('30 jours');
  const [transportRef, setTransportRef] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [fournisseurId, setFournisseurId] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [tierSearch, setTierSearch] = useState('');
  
  const [clients, setClients] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [lines, setLines] = useState<Array<{
    product_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
  }>>([]);

  useEffect(() => {
    if (open) {
      loadTiers();
      if (initialData) {
        setNotes(initialData.note || '');
        setValidity('30 jours');
        setTransportRef('');
        setDocumentDate(initialData.date);
        setClientId(null);
        setFournisseurId(null);
        setSelectedTier(null);
        setTierSearch('');
        setLines([{
          product_id: initialData.productId,
          product_name: initialData.productName,
          sku: initialData.sku,
          quantity: initialData.quantity,
          unit_price: initialData.unitPrice,
        }]);
      } else {
        resetForm();
      }
    }
  }, [open, type, initialData]);

  const loadTiers = async () => {
    const [cRes, fRes] = await Promise.all([
      supabase.from('clients').select('*').order('nom'),
      supabase.from('fournisseurs').select('*').order('nom')
    ]);
    if (cRes.data) setClients(cRes.data);
    if (fRes.data) setFournisseurs(fRes.data);
  };

  const resetForm = () => {
    setNotes('');
    setValidity('30 jours');
    setTransportRef('');
    setDocumentDate(new Date().toISOString().split('T')[0]);
    setClientId(null);
    setFournisseurId(null);
    setSelectedTier(null);
    setTierSearch('');
    setLines([]);
  };

  useEffect(() => {
    if (clientId) {
      const c = clients.find(cl => cl.id === clientId);
      setSelectedTier(c);
    } else if (fournisseurId) {
      const f = fournisseurs.find(fl => fl.id === fournisseurId);
      setSelectedTier(f);
    } else {
      setSelectedTier(null);
    }
  }, [clientId, fournisseurId, clients, fournisseurs]);

  const addLine = (product: Product) => {
    if (lines.some(l => l.product_id === product.id)) {
      toast.error("Ce produit est déjà dans la liste");
      return;
    }
    setLines([...lines, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku || '',
      quantity: 1,
      unit_price: product.price || 0
    }]);
  };

  const removeLine = (productId: number) => {
    setLines(lines.filter(l => l.product_id !== productId));
  };

  const updateLine = (productId: number, field: string, value: any) => {
    setLines(lines.map(l => l.product_id === productId ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async (generatePDF = false) => {
    if (lines.length === 0) {
      toast.error("Veuillez ajouter au moins un produit");
      return;
    }

    if ((type === 'BL_CLIENT' || type === 'BS') && !clientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    setLoading(true);
    try {
      const result = await documentService.createDocument({
        type,
        status: 'PENDING',
        clientId: clientId || undefined,
        fournisseurId: fournisseurId || undefined,
        notes,
        metadata: { 
          origin: 'magasin',
          document_date: documentDate,
          validity,
          transport_ref: transportRef,
          third_party_name: selectedTier?.nom || selectedTier?.raison_sociale || '',
          third_party_address: selectedTier?.adresse || '',
          third_party_tax_id: selectedTier?.matricule_fiscal || selectedTier?.tax_id || '',
          ...(initialData
            ? {
                source: 'stock_transaction',
                ...(initialData.transactionId ? { transaction_id: initialData.transactionId } : {}),
                linked_quantity: initialData.quantity,
                linked_product_id: initialData.productId,
              }
            : {}),
        },
        lines: lines.map(l => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price
        }))
      });

      if (result.success) {
        toast.success("Document créé avec succès");
        if (mandatory || initialData) {
          clearPendingWarehouseDocument();
        }
        if (generatePDF && result.document) {
          // Add back relation data for PDF
          const docForPDF = {
            ...result.document,
            lines: lines.map(l => ({
              ...l,
              products: { name: l.product_name }
            })),
            client_name: type === 'BL_CLIENT' || type === 'BS' ? selectedTier?.nom : null,
            fournisseur_name: type === 'BE' ? selectedTier?.nom : null
          };
          await downloadUnifiedDocumentPDF(docForPDF as any);
        }
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error("Erreur : " + result.error);
      }
    } catch (error: any) {
      toast.error("Erreur lors de la création : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const titleMap: Record<UnifiedDocumentType, string> = {
    'BE': "Bon d'Entrée Stock",
    'BS': "Bon de Sortie Stock",
    'BL_CLIENT': "Bon de Livraison Client",
    'DEMANDE_ACHAT': "Demande d'Achat",
    'BC_CLIENT': "Bon de Commande Client",
    'DEVIS_FOURNISSEUR': "Devis Fournisseur",
    'BC_FOURNISSEUR': "Bon de Commande Fournisseur",
    'BL_FOURNISSEUR': "Bon de Livraison Fournisseur",
    'FACTURE': "Facture"
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    const companyId = getActiveCompanyIdForQuery();
    if (!nextOpen && mandatory && readPendingWarehouseDocument(companyId)) {
      toast.error(
        type === 'BE'
          ? "Le bon d'entrée est obligatoire pour finaliser cette transaction."
          : 'Le bon de sortie est obligatoire pour finaliser cette transaction.'
      );
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className={`max-w-5xl max-h-[95vh] overflow-y-auto${mandatory ? ' [&>button]:hidden' : ''}`}
        onInteractOutside={(e) => mandatory && e.preventDefault()}
        onEscapeKeyDown={(e) => mandatory && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {titleMap[type] || "Nouveau Document"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire de création de {titleMap[type] || 'document magasin'}.
          </DialogDescription>
          {mandatory && (
            <p className="text-sm text-amber-600 dark:text-amber-400 pt-2">
              Ce document est obligatoire suite à la transaction stock enregistrée.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Section 1: Informations Générales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-xl border">
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Validité</Label>
              <Input 
                placeholder="Ex: 30 jours" 
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Réf. Transport</Label>
              <Input 
                placeholder="Ex: TUN-1234" 
                value={transportRef}
                onChange={(e) => setTransportRef(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date Document</Label>
              <Input 
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          {/* Section 2: Tiers (Client/Fournisseur) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
              {type === 'BE' ? 'Informations Fournisseur' : 'Informations Client'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sélectionner {(type === 'BL_CLIENT' || type === 'BS') ? 'un Client' : 'un Fournisseur'}</Label>
                  <Input
                    id="tierSearch"
                    placeholder={`Tapez pour rechercher ${(type === 'BL_CLIENT' || type === 'BS') ? 'client' : 'fournisseur'}`}
                    value={tierSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTierSearch(val);
                      const list = (type === 'BE' ? fournisseurs : clients).filter(t =>
                        (t.nom || t.raison_sociale).toLowerCase().includes(val.toLowerCase())
                      );
                      if (list.length === 1) {
                        if (type === 'BE') {
                          setFournisseurId(list[0].id);
                        } else {
                          setClientId(list[0].id);
                        }
                        setSelectedTier(list[0]);
                      } else {
                        setSelectedTier(null);
                        if (type === 'BE') setFournisseurId(null);
                        else setClientId(null);
                      }
                    }}
                    list="tier-options"
                  />
                  <datalist id="tier-options">
                    {(type === 'BE' ? fournisseurs : clients).map(t => (
                      <option key={t.id} value={t.nom || t.raison_sociale} />
                    ))}
                  </datalist>
                </div>
                
                {selectedTier && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 space-y-2 animate-in fade-in slide-in-from-top-2">
                    <p className="font-bold text-primary">{selectedTier.nom || selectedTier.raison_sociale}</p>
                    <p className="text-sm text-muted-foreground flex gap-2">
                      <span className="font-medium text-foreground">Adresse:</span> {selectedTier.adresse || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground flex gap-2">
                      <span className="font-medium text-foreground">MF / Tax ID:</span> {selectedTier.matricule_fiscal || selectedTier.tax_id || 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes / Observations</Label>
                <textarea 
                  className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Ajouter des notes internes ou externes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Articles */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Articles & Produits
              </h3>
            </div>
            
            <div className="bg-muted/30 p-6 rounded-xl border border-dashed border-primary/20">
               <Label className="block mb-3 text-primary/70 font-medium">Ajouter un article au document</Label>
               <CategoryProductSelector 
                  selectedProductId={null}
                  onSelect={(product) => addLine(product)}
               />
            </div>

            <div className="space-y-2">
              {lines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed flex flex-col items-center gap-2">
                  <Plus className="w-8 h-8 opacity-20" />
                  <p>Aucun article ajouté à ce document</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-xs">Produit</th>
                        <th className="p-4 text-center font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Quantité</th>
                        <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Prix Unitaire</th>
                        <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Total HT</th>
                        <th className="p-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-card">
                      {lines.map((line) => (
                        <tr key={line.product_id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-base">{line.product_name}</div>
                            <div className="text-xs font-mono text-primary/70">{line.sku}</div>
                          </td>
                          <td className="p-4">
                            <Input 
                              type="number" 
                              min="1" 
                              className="h-10 text-center font-bold"
                              value={line.quantity}
                              onChange={(e) => updateLine(line.product_id, 'quantity', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-4 text-right">
                            <DecimalInput
                              className="h-10 text-right font-medium"
                              value={line.unit_price ?? 0}
                              onValueChange={(v) => updateLine(line.product_id, 'unit_price', v)}
                            />
                          </td>
                          <td className="p-4 text-right font-bold text-base text-primary">
                            {(line.quantity * line.unit_price).toFixed(3)}
                          </td>
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                              onClick={() => removeLine(line.product_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t">
                      <tr>
                        <td colSpan={3} className="p-6 text-right font-black uppercase tracking-widest text-xs text-muted-foreground">Total Global (TND)</td>
                        <td className="p-6 text-right font-black text-2xl text-primary">
                          {lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0).toFixed(3)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 mt-4 border-t pt-6">
          {!mandatory && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="h-12 px-6">
              Annuler
            </Button>
          )}
          <Button 
            variant="secondary"
            onClick={() => handleSubmit(false)} 
            disabled={loading} 
            className="h-12 px-6 gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer seulement
          </Button>
          <Button 
            onClick={() => handleSubmit(true)} 
            disabled={loading} 
            className="h-12 px-6 gap-2 bg-primary hover:bg-primary/90"
          >
            <Download className="w-4 h-4" />
            Enregistrer & Générer PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

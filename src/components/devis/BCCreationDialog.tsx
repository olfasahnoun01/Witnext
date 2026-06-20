import { useState, useCallback, useMemo, useEffect } from 'react';
import { Devis, DevisItem, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Search, Package, AlertCircle } from 'lucide-react';
import { computeDevisTotals, computeDevisLine } from '@/lib/devisPricing';
import { mergeDevisItemsFromSources } from '@/lib/mergeCommercialDocuments';
import { getDevisItemDisplayCode } from '@/lib/devisItemPdf';
import { mapLightRowToProduct, searchInventoryProductsLight } from '@/lib/inventoryProductSearch';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface BCCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Un ou plusieurs devis sources (fusion = plusieurs devis → un BC). */
  sourceDevisList: Devis[];
  onConfirm: (items: DevisItem[], status: 'brouillon' | 'envoyé' | 'confirmé') => void;
}

export const BCCreationDialog = ({
  open,
  onOpenChange,
  sourceDevisList,
  onConfirm,
}: BCCreationDialogProps) => {
  const sourceDevis = sourceDevisList[0] ?? null;
  const isMerge = sourceDevisList.length > 1;
  const [items, setItems] = useState<DevisItem[]>([]);
  const [bcStatus, setBcStatus] = useState<'brouillon' | 'envoyé' | 'confirmé'>('confirmé');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);

  useEffect(() => {
    if (open && sourceDevisList.length > 0) {
      const initial = isMerge
        ? mergeDevisItemsFromSources(sourceDevisList)
        : JSON.parse(JSON.stringify(sourceDevisList[0].items));
      setItems(initial);
      setBcStatus('confirmé');
    }
  }, [open, sourceDevisList, isMerge]);

  // Search existing products (name or sku contains; up to 150 merged)
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const search = async () => {
      setIsSearching(true);
      const isAchat = sourceDevis?.type === 'achat';
      const rows = await searchInventoryProductsLight({
        searchTerm: debouncedSearch,
        perBranchLimit: 100,
        maxResults: 150,
        fournisseurExact:
          isAchat && sourceDevis?.third_party_name?.trim()
            ? sourceDevis.third_party_name.trim()
            : null,
      });
      if (cancelled) return;
      setSearchResults(rows.map(mapLightRowToProduct));
      setIsSearching(false);
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, sourceDevis?.type, sourceDevis?.third_party_name]);

  const addItemFromProduct = useCallback((product: Product) => {
    const sku = product.sku?.trim();
    const sizeColorParts = [
      product.size ? `Taille: ${product.size}` : '',
      product.color ? `Couleur: ${product.color}` : '',
    ].filter(Boolean);
    setItems(prev => [...prev, {
      designation: product.name,
      fournisseur: product.fournisseur || '',
      prix_ttc: product.price || 0,
      remise: product.remise || 0,
      quantity: 1,
      ...(sku ? { sku } : {}),
      product_id: product.id,
      description: sizeColorParts.length > 0 ? sizeColorParts.join(' · ') : undefined,
      tva: 19,
      ...(sourceDevis?.type === 'vente' ? { prix_achat: product.price || 0 } : {}),
    }]);
    setProductSearch('');
    setSearchResults([]);
    toast.success('Article ajouté');
  }, [sourceDevis]);

  const removeItem = useCallback((idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateItemQty = useCallback((idx: number, qty: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  }, []);

  const updateItemPrice = useCallback((idx: number, price: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, prix_ttc: Math.max(0, price) } : item));
  }, []);

  const updateItemRemise = useCallback((idx: number, remise: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, remise: Math.min(100, Math.max(0, remise)) } : item));
  }, []);

  const updateItemAchat = useCallback((idx: number, price: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, prix_achat: Math.max(0, price) } : item));
  }, []);

  const updateItemTva = useCallback((idx: number, tva: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, tva } : item));
  }, []);

  const totals = useMemo(() => {
    return computeDevisTotals(items, false, {
      devisType: sourceDevis.type as 'achat' | 'vente',
      docType: 'bc',
      isTvaEnabled: sourceDevis.is_ttc ?? false
    });
  }, [items, sourceDevis]);

  if (!sourceDevis) return null;

  const sourceLabel = isMerge
    ? sourceDevisList.map((d) => d.devis_number).join(', ')
    : sourceDevis.devis_number;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isMerge
              ? `Fusionner ${sourceDevisList.length} devis en un bon de commande`
              : `Révision du Bon de Commande pour ${sourceDevis.devis_number}`}
          </DialogTitle>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 p-2 rounded-md flex items-center gap-2 mt-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {isMerge
                ? `Devis sources : ${sourceLabel}. Les devis restent dans la liste ; une note de liaison au BC sera ajoutée.`
                : 'Le devis original reste dans la liste. Seul le nouveau BC est créé.'}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-thin">
          <div className="grid gap-2 max-w-sm">
            <Label>Statut du BC à créer</Label>
            <Select value={bcStatus} onValueChange={(value) => setBcStatus(value as 'brouillon' | 'envoyé' | 'confirmé')}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="envoyé">Envoyé</SelectItem>
                <SelectItem value="confirmé">Confirmé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add Item Search */}
          <div className="relative">
            <Label className="mb-2 block">Ajouter un article supplémentaire</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="max-h-60 overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItemFromProduct(product)}
                      className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center justify-between border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{product.price.toFixed(3)} TND</p>
                        <p className="text-[10px] text-muted-foreground">{product.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[70px] px-2 text-center">Qté</TableHead>
                  <TableHead className="w-[110px]">Code article</TableHead>
                  <TableHead className="w-[180px]">Désignation</TableHead>
                  <TableHead className="min-w-[120px]">Détails</TableHead>
                  {sourceDevis.type === 'vente' && (
                    <TableHead className="text-right w-[110px]">Prix Achat HT</TableHead>
                  )}
                  <TableHead className="text-right w-[110px]">Prix Vente HT</TableHead>
                  <TableHead className="text-center w-[80px]">Remise %</TableHead>
                  <TableHead className="text-center w-[90px]">TVA %</TableHead>
                  <TableHead className="text-right w-[110px]">Vente TTC</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Aucun article dans ce BC
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => {
                    const pricing = computeDevisLine(item, false);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="px-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="h-8 text-center px-1"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap" title={getDevisItemDisplayCode(item)}>
                          {getDevisItemDisplayCode(item)}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-xs line-clamp-2" title={item.designation}>{item.designation}</p>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground italic line-clamp-2">
                          {item.description || '—'}
                        </TableCell>
                        {sourceDevis.type === 'vente' && (
                          <TableCell className="text-right px-1">
                            <DecimalInput
                              value={item.prix_achat ?? 0}
                              onValueChange={(v) => updateItemAchat(idx, v)}
                              className="h-8 text-right w-full"
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-right px-1">
                          <DecimalInput
                            value={item.prix_ttc ?? 0}
                            onValueChange={(v) => updateItemPrice(idx, v)}
                            className="h-8 text-right w-full"
                          />
                        </TableCell>
                        <TableCell className="px-1">
                          <DecimalInput
                            value={item.remise ?? 0}
                            onValueChange={(v) => updateItemRemise(idx, v)}
                            allowEmptyZero
                            className="h-8 text-center px-1"
                          />
                        </TableCell>
                        <TableCell className="px-1">
                          <Select
                            value={(item.tva ?? 19).toString()}
                            onValueChange={(v) => updateItemTva(idx, parseInt(v))}
                          >
                            <SelectTrigger className="h-8 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="19">19%</SelectItem>
                              <SelectItem value="13">13%</SelectItem>
                              <SelectItem value="7">7%</SelectItem>
                              <SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs">
                          {pricing.unitAfterRemiseTTC.toFixed(3)}
                        </TableCell>
                        <TableCell className="px-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pr-4">
            <div className="w-64 space-y-2 bg-muted/30 p-4 rounded-xl border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">{totals.totalHT.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remise</span>
                <span className="font-medium text-destructive">-{totals.totalRemise.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA</span>
                <span className="font-medium">{totals.totalTVA.toFixed(3)} TND</span>
              </div>
              {totals.totalFodec !== undefined && totals.totalFodec > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FODEC (1%)</span>
                  <span className="font-medium">{totals.totalFodec.toFixed(3)} TND</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Timbre Fiscal</span>
                <span className="font-medium">1.000 TND</span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between font-bold text-primary">
                <span>TOTAL TTC</span>
                <span>{totals.totalFinal.toFixed(3)} TND</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button 
            onClick={() => onConfirm(items, bcStatus)} 
            disabled={items.length === 0}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Confirmer et Créer le BC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

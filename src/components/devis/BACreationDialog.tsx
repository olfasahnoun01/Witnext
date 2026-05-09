import { useState, useCallback, useMemo, useEffect } from 'react';
import { Devis, DevisItem, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Search, FileSignature, AlertCircle } from 'lucide-react';
import { computeDevisTotals, computeDevisLine } from '@/lib/devisPricing';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mapLightRowToProduct, searchInventoryProductsLight } from '@/lib/inventoryProductSearch';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Allocation {
  id: string;
  fournisseur: string;
  quantity: number;
  prix_ht: number;
  remise: number;
  tva: number;
}

interface BACreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBC: Devis | null;
  onConfirm: (items: DevisItem[]) => void;
}

export const BACreationDialog = ({
  open,
  onOpenChange,
  sourceBC,
  onConfirm,
}: BACreationDialogProps) => {
  const [items, setItems] = useState<(DevisItem & { localId: string })[]>([]);
  const [allocations, setAllocations] = useState<Record<string, Allocation[]>>({});
  const [activeTab, setActiveTab] = useState('requis');
  const [providerList, setProviderList] = useState<string[]>([]);
  const [previousAllocations, setPreviousAllocations] = useState<Record<string, number>>({});
  
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);

  // Sub-component for Provider Selection to manage local open state
  const AllocationProviderSelect = ({ 
    localId, 
    allocId, 
    value, 
    list 
  }: { 
    localId: string, 
    allocId: string, 
    value: string, 
    list: string[] 
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-8 text-xs justify-between font-normal border-transparent hover:border-border transition-all bg-transparent focus:bg-background",
              !value && "text-muted-foreground"
            )}
          >
            {value || "Choisir..."}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Chercher..." className="h-8" />
            <CommandList>
              <CommandEmpty>Aucun trouvé.</CommandEmpty>
              <CommandGroup>
                {list.map((provider) => (
                  <CommandItem
                    key={provider}
                    value={provider}
                    onSelect={() => {
                      updateAllocation(localId, allocId, 'fournisseur', provider);
                      setOpen(false); // Close on selection
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === provider ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {provider}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // Fetch providers
  useEffect(() => {
    const fetchProviders = async () => {
      const pageSize = 1000;
      let from = 0;
      const allNames: string[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('fournisseurs')
          .select('nom')
          .order('nom')
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('Failed to fetch fournisseurs list', error);
          break;
        }

        if (!data || data.length === 0) break;

        allNames.push(...data.map((p) => p.nom).filter((name): name is string => Boolean(name?.trim())));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      setProviderList(Array.from(new Set(allNames)));
    };
    fetchProviders();
  }, []);

  // Initialize items and default allocations when BC is provided
  useEffect(() => {
    if (sourceBC && open) {
      const initialItems = sourceBC.items.map(item => ({
        ...item,
        localId: Math.random().toString(36).substring(7)
      }));
      setItems(initialItems);
      
      const initialAllocations: Record<string, Allocation[]> = {};
      initialItems.forEach(item => {
        initialAllocations[item.localId] = [];
      });
      setAllocations(initialAllocations);

      // Fetch existing BAs to see what was already bought
      const fetchPreviousBAs = async () => {
        const { data, error } = await supabase
          .from('devis')
          .select('items')
          .eq('source_devis_id', sourceBC.id)
          .eq('is_ba', true);
        
        if (data && !error) {
          const totals: Record<string, number> = {};
          data.forEach(ba => {
            (ba.items as DevisItem[]).forEach(item => {
              const key = item.designation.trim().toLowerCase();
              totals[key] = (totals[key] || 0) + item.quantity;
            });
          });
          setPreviousAllocations(totals);
        }
      };
      fetchPreviousBAs();
    }
  }, [sourceBC, open]);

  // Search existing products (name or sku contains; up to 150 merged)
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const search = async () => {
      setIsSearching(true);
      const rows = await searchInventoryProductsLight({
        searchTerm: debouncedSearch,
        perBranchLimit: 100,
        maxResults: 150,
      });
      if (cancelled) return;
      setSearchResults(rows.map(mapLightRowToProduct));
      setIsSearching(false);
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const addItemFromProduct = useCallback((product: Product) => {
    const localId = Math.random().toString(36).substring(7);
    const newItem = {
      localId,
      designation: product.name,
      fournisseur: product.fournisseur || '',
      prix_ttc: product.price || 0,
      remise: product.remise || 0,
      quantity: 1,
      description: `${product.sku}${product.size ? ` - Taille: ${product.size}` : ''}${product.color ? ` - ${product.color}` : ''}`,
      tva: 19,
      ...(sourceBC?.type === 'vente' ? { prix_achat: product.price || 0 } : {}),
    };
    
    setItems(prev => [...prev, newItem]);
    setAllocations(prev => ({
      ...prev,
      [localId]: []
    }));

    setProductSearch('');
    setSearchResults([]);
    toast.success('Article ajouté');
  }, [sourceBC]);

  const removeItem = useCallback((localId: string) => {
    setItems(prev => prev.filter(item => item.localId !== localId));
    setAllocations(prev => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  }, []);

  const updateItemQty = useCallback((localId: string, qty: number) => {
    const validQty = Math.max(1, qty);
    setItems(prev => prev.map(item => item.localId === localId ? { ...item, quantity: validQty } : item));
    // Also update the first allocation if there's only one
    setAllocations(prev => {
      const itemAllocations = prev[localId] || [];
      if (itemAllocations.length === 1) {
        return {
          ...prev,
          [localId]: [{ ...itemAllocations[0], quantity: validQty }]
        };
      }
      return prev;
    });
  }, []);

  const updateItemPrice = useCallback((localId: string, price: number) => {
    setItems(prev => prev.map(item => item.localId === localId ? { ...item, prix_ttc: Math.max(0, price) } : item));
  }, []);

  const updateItemRemise = useCallback((localId: string, remise: number) => {
    setItems(prev => prev.map(item => item.localId === localId ? { ...item, remise: Math.min(100, Math.max(0, remise)) } : item));
  }, []);

  const updateItemAchat = useCallback((localId: string, price: number) => {
    setItems(prev => prev.map(item => item.localId === localId ? { ...item, prix_achat: Math.max(0, price) } : item));
  }, []);

  const updateItemTva = useCallback((localId: string, tva: number) => {
    setItems(prev => prev.map(item => item.localId === localId ? { ...item, tva } : item));
  }, []);

  // Allocation specific actions
  const addAllocationRow = (itemLocalId: string) => {
    const item = items.find(i => i.localId === itemLocalId);
    setAllocations(prev => ({
      ...prev,
      [itemLocalId]: [
        ...(prev[itemLocalId] || []),
        {
          id: Math.random().toString(36).substring(7),
          fournisseur: '',
          quantity: 1,
          prix_ht: item?.prix_achat || 0,
          remise: 0,
          tva: item?.tva || 19
        }
      ]
    }));
  };

  const removeAllocationRow = (itemLocalId: string, allocId: string) => {
    setAllocations(prev => ({
      ...prev,
      [itemLocalId]: (prev[itemLocalId] || []).filter(a => a.id !== allocId)
    }));
  };

  const updateAllocation = (itemLocalId: string, allocId: string, field: keyof Allocation, value: any) => {
    setAllocations(prev => ({
      ...prev,
      [itemLocalId]: (prev[itemLocalId] || []).map(a => a.id === allocId ? { ...a, [field]: value } : a)
    }));
  };

  // The actual items that will be returned are derived from allocations
  const confirmedItems = useMemo(() => {
    const finalItems: DevisItem[] = [];
    items.forEach(item => {
      const itemAllocations = allocations[item.localId] || [];
      itemAllocations.forEach(alloc => {
        finalItems.push({
          designation: item.designation,
          description: item.description,
          fournisseur: alloc.fournisseur,
          quantity: alloc.quantity,
          prix_ttc: alloc.prix_ht * (1 + alloc.tva / 100), // Note: internal calculations use prix_ttc for DevisItem usually
          remise: alloc.remise,
          tva: alloc.tva,
          ...(sourceBC?.type === 'vente' ? { prix_achat: alloc.prix_ht } : {}),
        });
      });
    });
    return finalItems;
  }, [items, allocations, sourceBC]);

  // Check if all created allocations have a supplier
  const allAllocationsHaveSupplier = useMemo(() => {
    const allRows = Object.values(allocations).flat();
    if (allRows.length === 0) return false;
    return allRows.every(a => a.fournisseur && a.fournisseur.trim() !== '');
  }, [allocations]);

  const totals = useMemo(() => {
    return computeDevisTotals(confirmedItems.length > 0 ? confirmedItems : items, false);
  }, [confirmedItems, items]);

  if (!sourceBC) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Révision du Bon d'Achat pour {sourceBC.devis_number}
          </DialogTitle>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 p-2 rounded-md flex items-center gap-2 mt-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Le Bon d'Achat est un document de validation. Il <strong>n'impacte pas le stock</strong>.
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="requis" className="gap-2">
                <Search className="w-4 h-4" /> Ce qu'on doit acheter
              </TabsTrigger>
              <TabsTrigger value="allocations" className="gap-2">
                <FileSignature className="w-4 h-4" /> Allocations Fournisseurs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="requis" className="flex-1 overflow-y-auto space-y-6 px-1 scrollbar-thin">
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
                      <TableHead className="w-[200px]">Désignation</TableHead>
                      {sourceBC.type === 'vente' && (
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
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun article dans ce Bon d'Achat
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => {
                        const pricing = computeDevisLine(item, false);
                        return (
                          <TableRow key={item.localId}>
                            <TableCell className="px-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItemQty(item.localId, parseInt(e.target.value) || 1)}
                                className="h-8 text-center px-1"
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-xs line-clamp-1" title={item.designation}>{item.designation}</p>
                              <p className="text-[9px] text-muted-foreground line-clamp-1">{item.description || '-'}</p>
                            </TableCell>
                            {sourceBC.type === 'vente' && (
                              <TableCell className="text-right px-1">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={item.prix_achat || 0}
                                  onChange={(e) => updateItemAchat(item.localId, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-right w-full"
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-right px-1">
                              <Input
                                type="number"
                                step="0.001"
                                value={item.prix_ttc}
                                onChange={(e) => updateItemPrice(item.localId, parseFloat(e.target.value) || 0)}
                                className="h-8 text-right w-full"
                              />
                            </TableCell>
                            <TableCell className="px-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={item.remise}
                                onChange={(e) => updateItemRemise(item.localId, parseFloat(e.target.value) || 0)}
                                className="h-8 text-center px-1"
                              />
                            </TableCell>
                            <TableCell className="px-1">
                              <Select
                                value={(item.tva ?? 19).toString()}
                                onValueChange={(v) => updateItemTva(item.localId, parseInt(v))}
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
                                onClick={() => removeItem(item.localId)}
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
            </TabsContent>

            <TabsContent value="allocations" className="flex-1 overflow-y-auto space-y-6 px-1 scrollbar-thin pb-4">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  Ajoutez des articles dans l'onglet précédent pour les allouer à des fournisseurs.
                </div>
              ) : (
                items.map((item) => {
                  const itemAllocations = allocations[item.localId] || [];
                  const totalAllocated = itemAllocations.reduce((sum, a) => sum + a.quantity, 0);
                  const isComplete = totalAllocated === item.quantity;
                  const isOver = totalAllocated > item.quantity;

                  return (
                    <Card key={item.localId} className={cn(
                      "border-l-4 transition-all duration-300",
                      isComplete ? "border-l-success shadow-sm" : isOver ? "border-l-destructive shadow-sm" : "border-l-amber-500 shadow-sm"
                    )}>
                      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-muted/10">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            {item.designation}
                            {isComplete && <CheckCircle2 className="w-4 h-4 text-success" />}
                            {!isComplete && !isOver && <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />}
                          </CardTitle>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold">
                            <span className={cn(
                              "text-sm px-2 py-0.5 rounded",
                              (previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated === item.quantity 
                                ? "bg-success/20 text-success" 
                                : (previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated > item.quantity 
                                ? "bg-destructive/20 text-destructive" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            )}>
                              {(previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated} / {item.quantity}
                            </span>
                          </p>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 font-bold">Cumul / Requis</p>
                          {(previousAllocations[item.designation.trim().toLowerCase()] || 0) > 0 && (
                            <p className="text-[9px] text-success font-medium mt-0.5">
                              ({previousAllocations[item.designation.trim().toLowerCase()]} déjà achetés)
                            </p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-0 bg-muted/5">
                              <TableHead className="text-xs py-2 h-auto">Fournisseur</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-24 text-center">Qté</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-32 text-right">P.U HT</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-20 text-center">R%</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-24 text-center">TVA</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-32 text-right">Total HT</TableHead>
                              <TableHead className="text-xs py-2 h-auto w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itemAllocations.map((alloc) => (
                              <TableRow key={alloc.id} className="group transition-colors border-border/40">
                                <TableCell className="py-2">
                                  <AllocationProviderSelect 
                                    localId={item.localId}
                                    allocId={alloc.id}
                                    value={alloc.fournisseur}
                                    list={providerList}
                                  />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Input 
                                    type="number"
                                    min="1"
                                    value={alloc.quantity}
                                    onChange={(e) => updateAllocation(item.localId, alloc.id, 'quantity', parseInt(e.target.value) || 0)}
                                    className="h-8 text-xs text-center font-bold"
                                  />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Input 
                                    type="number"
                                    step="0.001"
                                    value={alloc.prix_ht}
                                    onChange={(e) => updateAllocation(item.localId, alloc.id, 'prix_ht', parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs text-right"
                                  />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={alloc.remise}
                                    onChange={(e) => updateAllocation(item.localId, alloc.id, 'remise', parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs text-center px-1"
                                  />
                                </TableCell>
                                <TableCell className="py-2 px-1">
                                  <Select 
                                    value={String(alloc.tva)} 
                                    onValueChange={(v) => updateAllocation(item.localId, alloc.id, 'tva', Number(v))}
                                  >
                                    <SelectTrigger className="h-8 text-[10px] px-2 bg-transparent border-transparent group-hover:border-border transition-all">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">0%</SelectItem>
                                      <SelectItem value="7">7%</SelectItem>
                                      <SelectItem value="13">13%</SelectItem>
                                      <SelectItem value="19">19%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="py-2 text-right text-xs font-bold text-primary">
                                  {(alloc.prix_ht * alloc.quantity * (1 - alloc.remise/100)).toFixed(3)}
                                </TableCell>
                                <TableCell className="py-2">
                                  {itemAllocations.length > 1 && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => removeAllocationRow(item.localId, alloc.id)}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="p-2 bg-muted/5 flex justify-between items-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => addAllocationRow(item.localId)}
                            className="h-7 text-[10px] gap-1.5 font-bold hover:bg-primary transition-all hover:text-primary-foreground group"
                          >
                            <Plus className="w-3 h-3 group-hover:scale-125 transition-transform" /> ALLOUER À UN AUTRE FOURNISSEUR
                          </Button>
                          
                          {!isComplete && (
                            <p className={cn(
                              "text-[10px] font-bold flex items-center gap-1.5 px-3 py-1 rounded-full",
                              (previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated > item.quantity 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            )}>
                              <AlertCircle className="w-3 h-3" />
                              {(previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated > item.quantity 
                                ? `Excédent cumulative de ${(previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated - item.quantity} unités !` 
                                : `Il manque ${item.quantity - ((previousAllocations[item.designation.trim().toLowerCase()] || 0) + totalAllocated)} unités au total.`}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          {/* Totals Summary */}
          <div className="mt-4 flex justify-end pr-4 sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 border-t z-10">
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
            onClick={() => onConfirm(confirmedItems)} 
            disabled={confirmedItems.length === 0 || !allAllocationsHaveSupplier}
            className="gap-2 bg-primary font-bold shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Confirmer et Créer le BA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

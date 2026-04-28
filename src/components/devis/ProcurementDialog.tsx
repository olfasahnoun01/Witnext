import { useState, useCallback, useMemo, useEffect } from 'react';
import { UnifiedDocument } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, FileSignature, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { documentService } from '@/services/documentService';

interface Allocation {
  id: string;
  fournisseur_id: number;
  fournisseur_name: string;
  quantity: number;
  unit_price: number;
}

interface ProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The source document that needs supplier sourcing */
  sourceBC: UnifiedDocument | null;
  onSuccess: () => void;
}

export const ProcurementDialog = ({
  open,
  onOpenChange,
  sourceBC,
  onSuccess,
}: ProcurementDialogProps) => {
  const [allocations, setAllocations] = useState<Record<string, Allocation[]>>({});
  const [providers, setProviders] = useState<{id: number, nom: string}[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch providers
  useEffect(() => {
    const fetchProviders = async () => {
      const { data } = await supabase
        .from('fournisseurs')
        .select('id, nom')
        .order('nom');
      if (data) setProviders(data);
    };
    fetchProviders();
  }, []);

  // Initialize allocations when BC is provided
  useEffect(() => {
    if (sourceBC && open && sourceBC.lines) {
      const initialAllocations: Record<string, Allocation[]> = {};
      sourceBC.lines.forEach(line => {
        initialAllocations[line.id] = [];
      });
      setAllocations(initialAllocations);
    }
  }, [sourceBC, open]);

  const addAllocationRow = (lineId: string) => {
    setAllocations(prev => ({
      ...prev,
      [lineId]: [
        ...(prev[lineId] || []),
        {
          id: Math.random().toString(36).substring(7),
          fournisseur_id: 0,
          fournisseur_name: '',
          quantity: 1,
          unit_price: 0
        }
      ]
    }));
  };

  const removeAllocationRow = (lineId: string, allocId: string) => {
    setAllocations(prev => ({
      ...prev,
      [lineId]: (prev[lineId] || []).filter(a => a.id !== allocId)
    }));
  };

  const updateAllocation = async (lineId: string, allocId: string, field: keyof Allocation, value: any) => {
    setAllocations(prev => {
      const newAllocations = { ...prev };
      const itemAllocations = [...(newAllocations[lineId] || [])];
      const index = itemAllocations.findIndex(a => a.id === allocId);
      
      if (index !== -1) {
        itemAllocations[index] = { ...itemAllocations[index], [field]: value };
        
        // If supplier changed, try to fetch default price
        if (field === 'fournisseur_id') {
          const provider = providers.find(p => p.id === value);
          itemAllocations[index].fournisseur_name = provider?.nom || '';
          
          // Here we could fetch price from product_group_fournisseurs
          // For now, we'll keep it manual as requested in Prompt 3/4
        }
        
        newAllocations[lineId] = itemAllocations;
      }
      return newAllocations;
    });
  };

  const handleConfirm = async () => {
    if (!sourceBC) return;
    setLoading(true);

    try {
      // 1. Group allocations by supplier
      const supplierMap: Record<number, any[]> = {};
      
      Object.keys(allocations).forEach(lineId => {
        const line = sourceBC.lines?.find(l => l.id === lineId);
        allocations[lineId].forEach(alloc => {
          if (alloc.fournisseur_id === 0) return;
          
          if (!supplierMap[alloc.fournisseur_id]) {
            supplierMap[alloc.fournisseur_id] = [];
          }
          
          supplierMap[alloc.fournisseur_id].push({
            product_id: line?.product_id ?? null,
            quantity: alloc.quantity,
            unit_price: alloc.unit_price,
            description: line?.description
          });
        });
      });

      const supplierRequests = Object.keys(supplierMap).map(id => ({
        fournisseur_id: parseInt(id),
        items: supplierMap[parseInt(id)]
      }));

      if (supplierRequests.length === 0) {
        toast.error('Veuillez allouer au moins un article à un fournisseur');
        setLoading(false);
        return;
      }

      // 2. Call service
      const result = await documentService.createSupplierQuotesFromSource(sourceBC, supplierRequests);
      
      if (result.success) {
        toast.success(`${result.documents?.length} Devis Fournisseurs ont été créés.`);
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error('Erreur: ' + result.error);
      }
    } catch (error: any) {
      toast.error('Erreur lors de la création : ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const AllocationProviderSelect = ({ 
    lineId, 
    allocId, 
    valueId, 
    list 
  }: { 
    lineId: string, 
    allocId: string, 
    valueId: number, 
    list: {id: number, nom: string}[] 
  }) => {
    const [open, setOpen] = useState(false);
    const selected = list.find(p => p.id === valueId);

    // List of providers already selected for this specific product line
    // EXCLUDING the current row itself (so we can still see/re-select the current one if needed)
    const otherSelectedIds = useMemo(() => {
      const lineAllocations = allocations[lineId] || [];
      return lineAllocations
        .filter(a => a.id !== allocId && a.fournisseur_id !== 0)
        .map(a => a.fournisseur_id);
    }, [lineId, allocId]);

    const filteredList = useMemo(() => {
      return list.filter(p => !otherSelectedIds.includes(p.id));
    }, [list, otherSelectedIds]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full h-8 text-xs justify-between"
          >
            {selected ? selected.nom : "Choisir fournisseur..."}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandInput placeholder="Chercher fournisseur..." className="h-8" />
            <CommandList>
              <CommandEmpty>Aucun trouvé.</CommandEmpty>
              <CommandGroup>
                {filteredList.map((provider) => (
                  <CommandItem
                    key={provider.id}
                    value={provider.nom}
                    onSelect={() => {
                      updateAllocation(lineId, allocId, 'fournisseur_id', provider.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        valueId === provider.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {provider.nom}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  if (!sourceBC) return null;

  const sourceLabel = sourceBC.type === 'DEMANDE_ACHAT' ? 'demande d\'achat' : 'commande client';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Approvisionnement pour {sourceBC.numero}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sélectionnez les fournisseurs pour chaque article de la {sourceLabel}.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 p-1 scrollbar-thin">
          {sourceBC.lines?.map((line) => {
            const itemAllocations = allocations[line.id] || [];
            const totalAllocated = itemAllocations.reduce((sum, a) => sum + a.quantity, 0);
            
            return (
              <Card key={line.id} className={cn(
                "border-l-4",
                totalAllocated === line.quantity ? "border-l-green-500" : "border-l-amber-500"
              )}>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-muted/30">
                  <div>
                    <CardTitle className="text-sm font-bold">
                      {line.product_name || "Produit sans nom"}
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">{line.product_sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">
                      Alloué: <span className={totalAllocated > line.quantity ? "text-red-500" : ""}>{totalAllocated}</span> / {line.quantity}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead className="text-xs h-8">Fournisseur</TableHead>
                        <TableHead className="text-xs h-8 w-24 text-center">Quantité</TableHead>
                        <TableHead className="text-xs h-8 w-32 text-right">P.U Achat estimé</TableHead>
                        <TableHead className="text-xs h-8 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemAllocations.map((alloc) => (
                        <TableRow key={alloc.id}>
                          <TableCell className="py-2">
                            <AllocationProviderSelect 
                              lineId={line.id}
                              allocId={alloc.id}
                              valueId={alloc.fournisseur_id}
                              list={providers}
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input 
                              type="number"
                              value={alloc.quantity}
                              onChange={(e) => updateAllocation(line.id, alloc.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="h-8 text-center text-xs"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input 
                              type="number"
                              step="0.001"
                              value={alloc.unit_price}
                              onChange={(e) => updateAllocation(line.id, alloc.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-right text-xs"
                              placeholder="0.000"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                              onClick={() => removeAllocationRow(line.id, alloc.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t">
                    <Button 
                      variant="outline" size="sm" 
                      onClick={() => addAllocationRow(line.id)}
                      className="h-7 text-[10px] gap-1"
                    >
                      <Plus className="w-3 h-3" /> DEMANDER UN DEVIS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-2">
            {loading ? "Création..." : (
              <>
                <FileSignature className="w-4 h-4" />
                Générer {new Set(Object.values(allocations).flat().filter(a => a.fournisseur_id !== 0).map(a => a.fournisseur_id)).size} Devis Fournisseurs
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

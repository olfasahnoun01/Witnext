import { Check, ChevronsUpDown, Layers, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { AddVariantDialogProps } from '@/modules/commercial/quotations/hooks/useDevisArticleDialogs';

export type { AddVariantDialogProps };

export function DevisAddVariantDialog({
  open,
  onOpenChange,
  productGroups,
  selectedGroupId,
  setSelectedGroupId,
  variantSku,
  setVariantSku,
  variantSize,
  setVariantSize,
  variantColor,
  setVariantColor,
  variantQuantity,
  setVariantQuantity,
  groupSearch,
  setGroupSearch,
  groupPopoverOpen,
  setGroupPopoverOpen,
  filteredGroups,
  variantFicheFiles,
  setVariantFicheFiles,
  variantFicheRef,
  handleCreateVariant,
  isCreatingVariant,
  sizes,
  colors,
}: AddVariantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Ajouter une Variante
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search & select product group */}
          <div>
            <Label>Article existant *</Label>
            <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedGroupId
                    ? productGroups.find((g) => g.id.toString() === selectedGroupId)?.name ||
                      'Sélectionner...'
                    : 'Rechercher un article...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Rechercher..."
                    value={groupSearch}
                    onValueChange={setGroupSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Aucun article trouvé</CommandEmpty>
                    <CommandGroup>
                      {filteredGroups.map((g) => (
                        <CommandItem
                          key={g.id}
                          value={`${g.name} ${g.base_sku || ''}`}
                          onSelect={() => {
                            setSelectedGroupId(g.id.toString());
                            setGroupPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedGroupId === g.id.toString() ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="font-medium">{g.name}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            ({g.base_sku || 'N/A'}) - {g.category}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Taille</Label>
              <Select value={variantSize} onValueChange={setVariantSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Taille" />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Couleur</Label>
              <Select value={variantColor} onValueChange={setVariantColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Couleur" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Code Article (SKU)</Label>
            <Input
              value={variantSku}
              onChange={(e) => setVariantSku(e.target.value)}
              placeholder="Auto-généré"
            />
          </div>

          <div>
            <Label>Quantité initiale</Label>
            <Input
              type="number"
              min={0}
              value={variantQuantity}
              onChange={(e) => setVariantQuantity(Number(e.target.value))}
            />
          </div>

          {/* Fiche Technique */}
          <div>
            <Label>Fiches Techniques (PDF/Images — multiple)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={variantFicheRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      setVariantFicheFiles((prev) => [...prev, ...Array.from(files)]);
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => variantFicheRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {variantFicheFiles.length > 0
                    ? `${variantFicheFiles.length} fichier(s)`
                    : 'Choisir des fichiers'}
                </Button>
                {variantFicheFiles.length > 0 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setVariantFicheFiles([])}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {variantFicheFiles.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {variantFicheFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="truncate max-w-[200px]">{f.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => setVariantFicheFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void handleCreateVariant()} disabled={isCreatingVariant}>
            {isCreatingVariant ? 'Création...' : 'Créer Variante'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

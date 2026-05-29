import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CounterpartyOption } from '../../types/paymentTypes';

interface CounterpartyComboboxProps {
  options: CounterpartyOption[];
  value: CounterpartyOption | null;
  onChange: (value: CounterpartyOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Sélecteur de tiers avec recherche (raison sociale + matricule fiscal). */
export function CounterpartyCombobox({
  options,
  value,
  onChange,
  placeholder = 'Rechercher un tiers…',
  disabled,
}: CounterpartyComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-10 py-2"
        >
          {value ? (
            <span className="truncate text-left">
              <span className="font-medium">{value.raisonSociale}</span>
              {value.matriculeFiscal && (
                <span className="text-muted-foreground text-xs block">MF : {value.matriculeFiscal}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nom ou matricule fiscal…" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Aucun tiers trouvé.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.raisonSociale} ${opt.matriculeFiscal ?? ''}`}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value?.id === opt.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{opt.raisonSociale}</p>
                    {opt.matriculeFiscal && (
                      <p className="text-xs text-muted-foreground truncate">MF : {opt.matriculeFiscal}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

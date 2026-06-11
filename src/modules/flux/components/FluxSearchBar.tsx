import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FluxSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function FluxSearchBar({ value, onChange, className }: FluxSearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un client ou un fournisseur…"
        className="pl-10 h-12 text-base rounded-xl"
      />
    </div>
  );
}

import { Building2, ChevronsUpDown } from 'lucide-react';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * App-wide company switcher. Shown only when the user belongs to more than one
 * company; otherwise the single company is pinned silently. Changing the
 * selection updates the active-company store and fires COMPANY_CHANGED_EVENT so
 * module loaders refresh.
 */
export function CompanySwitcher() {
  const { companies, currentCompanyId, canSwitchCompany, setCompany, loading } = useAppCompany();

  if (loading || companies.length === 0) return null;

  if (!canSwitchCompany) {
    const only = companies[0];
    return (
      <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-foreground">{only?.name}</span>
      </div>
    );
  }

  return (
    <Select value={currentCompanyId ?? undefined} onValueChange={setCompany}>
      <SelectTrigger className="h-9 w-[180px] gap-2 border-2">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <SelectValue placeholder="Société" />
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

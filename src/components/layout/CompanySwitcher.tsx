import { Building2 } from 'lucide-react';
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
      <div className="hidden md:flex max-w-[14rem] min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground" title={only?.name}>
          {only?.name}
        </span>
      </div>
    );
  }

  const currentName = companies.find((c) => c.id === currentCompanyId)?.name;

  return (
    <Select value={currentCompanyId ?? undefined} onValueChange={setCompany}>
      <SelectTrigger
        className="h-9 w-auto min-w-[10.5rem] max-w-[14rem] gap-2 border border-border bg-card px-3 text-sm [&>span]:min-w-0 [&>span]:truncate"
        title={currentName}
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <SelectValue placeholder="Société" />
      </SelectTrigger>
      <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id} className="truncate">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

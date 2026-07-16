import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyCompanyAccessCode, financeCompanyRequiresCode } from '../lib/companyAccess';
import { FinanceCompanyLogo } from './FinanceCompanyLogo';
import type { FinanceCompanyRow } from '../types';

interface FinanceCompanyPickerProps {
  companies: FinanceCompanyRow[];
  onSelect: (company: FinanceCompanyRow) => void;
  /** Si true, l'utilisateur doit saisir le code société avant ouverture. */
  requireAccessCode?: boolean;
}

export function FinanceCompanyPicker({
  companies,
  onSelect,
  requireAccessCode = false,
}: FinanceCompanyPickerProps) {
  const [codes, setCodes] = useState<Record<string, string>>({});

  const handleOpen = (company: FinanceCompanyRow) => {
    // Only enforce a code when one is actually configured for this company.
    if (requireAccessCode && financeCompanyRequiresCode(company.code)) {
      const entered = codes[company.id] ?? '';
      if (!entered.trim()) {
        toast.error('Saisissez le code d\'accès de la société.');
        return;
      }
      if (!verifyCompanyAccessCode(company.code, entered)) {
        toast.error('Code incorrect pour cette société.');
        return;
      }
    }
    onSelect(company);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Finance multi-sociétés</h1>
        <p className="text-muted-foreground text-sm">
          {requireAccessCode
            ? 'Saisissez le code d\'accès de la société, puis ouvrez le module Finance.'
            : 'Sélectionnez la société pour laquelle vous souhaitez accéder au module Finance.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="border-border/80 hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex flex-col items-center gap-3 text-center">
                <FinanceCompanyLogo
                  code={c.code}
                  companyName={c.name}
                  logoUrl={c.logo_url}
                  className="h-16 w-full"
                  imageClassName="max-h-12"
                />
                <CardTitle className="text-base">{c.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {requireAccessCode && financeCompanyRequiresCode(c.code) && (
                <div className="space-y-1.5">
                  <Label htmlFor={`code-${c.id}`} className="text-xs flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    Code société
                  </Label>
                  <Input
                    id={`code-${c.id}`}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="•••"
                    value={codes[c.id] ?? ''}
                    onChange={(e) =>
                      setCodes((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleOpen(c);
                    }}
                  />
                </div>
              )}
              <Button className="w-full" onClick={() => handleOpen(c)}>
                Ouvrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

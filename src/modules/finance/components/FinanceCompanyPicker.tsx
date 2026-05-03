import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceCompanyRow } from '../types';

interface FinanceCompanyPickerProps {
  companies: FinanceCompanyRow[];
  onSelect: (company: FinanceCompanyRow) => void;
}

export function FinanceCompanyPicker({ companies, onSelect }: FinanceCompanyPickerProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Finance multi-societes</h1>
        <p className="text-muted-foreground text-sm">
          Selectionnez la societe pour laquelle vous souhaitez acceder au module Finance.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="border-border/80 hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" />
                <CardTitle className="text-base">{c.name}</CardTitle>
              </div>
              <CardDescription className="font-mono text-xs uppercase">{c.code}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => onSelect(c)}>
                Ouvrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

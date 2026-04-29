import { ClipboardList, FileText, Truck, ReceiptText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VentesWorkflowProps {
  currentStep: 'devis' | 'bc' | 'bl' | 'facture';
  onNavigate: (tab: string) => void;
}

const STEPS = [
  { id: 'devis-vente', label: '1. Devis', description: 'Créez un devis commercial.', icon: ClipboardList },
  { id: 'bc-vente', label: '2. Bon de commande', description: 'Transformez le devis en bon de commande.', icon: FileText },
  { id: 'bl-vente', label: '3. Bon de livraison', description: 'Générez la livraison depuis le stock.', icon: Truck },
  { id: 'factures-vente', label: '4. Facture', description: 'Émettez la facture après livraison.', icon: ReceiptText },
];

export const VentesWorkflow = ({ currentStep, onNavigate }: VentesWorkflowProps) => {
  return (
    <Card className="mb-6 border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Processus de vente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-4">
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const StepIcon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  'rounded-3xl border p-5 transition-all',
                  isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-muted/50 bg-muted/10'
                )}
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <StepIcon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  {isActive && <ArrowRight className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                <Button
                  size="sm"
                  variant={isActive ? 'secondary' : 'outline'}
                  className="mt-4 w-full"
                  onClick={() => onNavigate(step.id)}
                >
                  {isActive ? 'Étape en cours' : 'Aller à'}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

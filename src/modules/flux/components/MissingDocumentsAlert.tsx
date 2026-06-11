import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MissingDocumentsAlertProps {
  labels: string[];
}

export function MissingDocumentsAlert({ labels }: MissingDocumentsAlertProps) {
  if (labels.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Documents manquants ou incomplets</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sm">
          {labels.map((l) => (
            <li key={l}>{l} non créé ou non validé</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

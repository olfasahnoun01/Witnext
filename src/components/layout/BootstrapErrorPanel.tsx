import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BootstrapErrorPanelProps {
  title?: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

/** Shown when permissions or company context fail to load on startup. */
export function BootstrapErrorPanel({
  title = 'Chargement incomplet',
  message,
  onRetry,
  retrying = false,
}: BootstrapErrorPanelProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" onClick={onRetry} disabled={retrying} className="gap-2">
        <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
        Réessayer
      </Button>
      <p className="text-xs text-muted-foreground max-w-sm">
        Si le problème persiste, déconnectez-vous puis reconnectez-vous, ou contactez l&apos;administrateur.
      </p>
    </div>
  );
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isStaleChunkError, reloadOnceForStaleChunk } from '@/lib/lazyWithRetry';

type Props = { children: ReactNode; title?: string };
type State = { error: Error | null; reloading: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isStaleChunkError(error)) {
      // New deployment: old chunk URLs are gone. Reload once to fetch the new app.
      const reloading = reloadOnceForStaleChunk();
      if (reloading) this.setState({ reloading: true });
    }
  }

  render() {
    if (this.state.error) {
      if (this.state.reloading) {
        return (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Nouvelle version détectée — rechargement…
            </p>
          </div>
        );
      }
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.title ?? 'Une erreur est survenue'}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message || 'Erreur inattendue'}
          </p>
          <Button
            type="button"
            onClick={() => {
              this.setState({ error: null, reloading: false });
              window.location.reload();
            }}
          >
            Recharger l&apos;application
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

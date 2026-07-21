import { forwardRef, useCallback, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  isRetryableTurnstileError,
  turnstileErrorMessage,
  turnstileSiteKey,
} from '@/lib/turnstile';

type TurnstileCaptchaProps = {
  onToken: (token: string | null) => void;
  className?: string;
};

/**
 * Turnstile widget that does not reset on non-retryable errors (e.g. 110200),
 * which would otherwise spam the console in an infinite loop.
 */
export const TurnstileCaptcha = forwardRef<TurnstileInstance, TurnstileCaptchaProps>(
  function TurnstileCaptcha({ onToken, className }, ref) {
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [widgetKey, setWidgetKey] = useState(0);

    const clearError = useCallback(() => {
      setErrorCode(null);
      onToken(null);
    }, [onToken]);

    const handleRetry = useCallback(() => {
      clearError();
      setWidgetKey((k) => k + 1);
    }, [clearError]);

    if (errorCode && !isRetryableTurnstileError(errorCode)) {
      return (
        <Alert variant="destructive" className={className}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Captcha indisponible</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{turnstileErrorMessage(errorCode)}</p>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleRetry}>
              <RefreshCw className="h-3 w-3" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className={className ?? 'flex justify-center overflow-hidden rounded-lg'}>
        <Turnstile
          key={widgetKey}
          ref={ref}
          siteKey={turnstileSiteKey}
          options={{ retry: 'never' }}
          onSuccess={(token) => {
            setErrorCode(null);
            onToken(token);
          }}
          onExpire={() => onToken(null)}
          onError={(code) => {
            onToken(null);
            const normalized = String(code ?? '').trim() || 'unknown';
            setErrorCode(normalized);
            // Do not call reset() here — non-retryable codes loop forever.
          }}
        />
      </div>
    );
  }
);

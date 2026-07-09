import { useCallback, useEffect, useRef } from 'react';

type Options = {
  enabled?: boolean;
  /** Min ms between keystrokes to treat as scanner input (default 50) */
  maxGapMs?: number;
  onScan: (barcode: string) => void;
};

/**
 * Listens for USB/Bluetooth barcode scanner input (keyboard wedge).
 * Scanners type rapidly and end with Enter.
 */
export function useBarcodeScanner({ enabled = true, maxGapMs = 50, onScan }: Options) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > maxGapMs) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= 3) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isEditable) {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, maxGapMs]);

  return { resetBuffer };
}

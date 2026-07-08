import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type LazyFactory<T extends ComponentType<unknown>> = () => Promise<{ default: T }>;

const RELOAD_STAMP_KEY = 'grosafe:stale-chunk-reload-at';
/** Minimum delay between two automatic reloads (avoids reload loops when offline). */
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * True when a dynamic import failed because the chunk no longer exists on the
 * server (typical after a redeploy: hashed filenames changed, old ones 404 or
 * are rewritten to index.html → "text/html MIME" module errors).
 */
export function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as Error | undefined)?.message ?? error ?? '');
  return /failed to fetch dynamically imported module|error loading dynamically imported module|failed to load module script|importing a module script failed|expected a javascript.*module/i.test(
    msg
  );
}

/**
 * Reload the page once to pick up the new deployment.
 * Returns false when a reload already happened recently (prevents loops).
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode) — still reload, loop risk is low.
  }
  window.location.reload();
  return true;
}

/**
 * Lazy import that survives redeploys: brief retries for transient network
 * errors, then a one-shot full reload when the chunk is permanently gone
 * (stale hashed URL). The reload fetches the new index.html and new chunks.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: LazyFactory<T>,
  retries = 1
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    }
    if (isStaleChunkError(lastError) && reloadOnceForStaleChunk()) {
      // Page is reloading — never resolve so the error UI does not flash.
      return new Promise<never>(() => {});
    }
    throw lastError;
  });
}

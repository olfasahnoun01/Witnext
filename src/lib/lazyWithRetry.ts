import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type LazyFactory<T extends ComponentType<unknown>> = () => Promise<{ default: T }>;

/**
 * Lazy import with retries — recovers from stale chunk URLs after deploy.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: LazyFactory<T>,
  retries = 2
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}

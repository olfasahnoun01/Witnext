/**
 * Simple in‑memory storage that mimics the `localStorage` API used by Supabase.
 * It lives only for the lifetime of the page (no persistence across reloads).
 * This prevents JWTs from being written to persistent browser storage.
 */
export const inMemoryStorage = (() => {
  const store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    // The Supabase client may call `clear` – we provide a no‑op for safety.
    clear(): void {
      for (const k in store) delete store[k];
    },
  };
})();

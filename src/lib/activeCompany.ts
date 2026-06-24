/**
 * Module-level "active company" store.
 *
 * RLS is the authoritative isolation boundary, but the app must (a) stamp the
 * correct company_id on inserts so non-Grosafe rows pass RLS WITH CHECK, and
 * (b) filter selects to the *currently selected* company for multi-company
 * users. React state lives in AppCompanyContext; this tiny store mirrors it so
 * non-React data services (dbService, documentService, ...) can read the active
 * company synchronously without prop drilling.
 */

const STORAGE_KEY = 'erp.activeCompanyId';

/** localStorage key for cross-tab company sync. */
export const ACTIVE_COMPANY_STORAGE_KEY = STORAGE_KEY;

let activeCompanyId: string | null = null;
const listeners = new Set<() => void>();

try {
  if (typeof localStorage !== 'undefined') {
    activeCompanyId = localStorage.getItem(STORAGE_KEY);
  }
} catch {
  /* ignore storage access errors */
}

/** Current company id, or null before companies have loaded. */
export function getActiveCompanyId(): string | null {
  return activeCompanyId;
}

/** Update the active company and notify subscribers (no-op if unchanged). */
export function setActiveCompanyId(id: string | null): void {
  if (activeCompanyId === id) return;
  activeCompanyId = id;
  try {
    if (typeof localStorage !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.error('[activeCompany] listener failed:', err);
    }
  });
}

/** Subscribe to active-company changes; returns an unsubscribe function. */
export function onActiveCompanyChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Update in-memory active company from another tab's localStorage write.
 * Does not persist (avoids storage feedback loops).
 */
export function applyActiveCompanyFromStorage(
  storedId: string | null | undefined
): { id: string | null; changed: boolean } {
  const next = storedId?.trim() ? storedId : null;
  if (activeCompanyId === next) {
    return { id: next, changed: false };
  }
  activeCompanyId = next;
  listeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.error('[activeCompany] listener failed:', err);
    }
  });
  return { id: next, changed: true };
}

/** Spread into an insert payload to stamp the active company_id (when known). */
export function withCompany<T extends Record<string, unknown>>(payload: T): T & { company_id?: string } {
  const id = getActiveCompanyId();
  return id ? { ...payload, company_id: id } : payload;
}

/** Active company id required for tenant-scoped reads/writes. */
export function requireActiveCompanyId(): string {
  const id = getActiveCompanyId();
  if (!id) {
    throw new Error('Aucune société active sélectionnée. Choisissez une société avant de continuer.');
  }
  return id;
}

/** Returns active company id or null — use for reads that should return empty when unset. */
export function getActiveCompanyIdForQuery(): string | null {
  return getActiveCompanyId();
}

/**
 * Decide which company should be active given the user's accessible companies
 * and a previously persisted choice. Pure so it can be unit-tested:
 *   1. keep the persisted choice if it is still allowed,
 *   2. otherwise prefer Grosafe (historical default),
 *   3. otherwise the first company,
 *   4. otherwise null (no companies).
 */
export function resolveActiveCompanyId(
  companies: ReadonlyArray<{ id: string; code: string }>,
  persistedId: string | null
): string | null {
  if (persistedId && companies.some((c) => c.id === persistedId)) {
    return persistedId;
  }
  return companies.find((c) => c.code === 'grosafe')?.id ?? companies[0]?.id ?? null;
}

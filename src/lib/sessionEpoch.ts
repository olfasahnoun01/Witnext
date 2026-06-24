export const SESSION_EPOCH_KEY = 'grosafe_session_epoch';
export const TAB_SESSION_EPOCH_KEY = 'grosafe_tab_session_epoch';

export function bumpSessionEpoch(): string {
  const epoch = `${Date.now()}-${crypto.randomUUID()}`;
  localStorage.setItem(SESSION_EPOCH_KEY, epoch);
  sessionStorage.setItem(TAB_SESSION_EPOCH_KEY, epoch);
  return epoch;
}

/** Create a shared epoch only when missing — does not invalidate other tabs. */
export function getOrCreateGlobalSessionEpoch(): string {
  const existing = readGlobalSessionEpoch();
  if (existing) return existing;
  const epoch = `${Date.now()}-${crypto.randomUUID()}`;
  try {
    localStorage.setItem(SESSION_EPOCH_KEY, epoch);
  } catch {
    /* ignore */
  }
  return epoch;
}

export function readGlobalSessionEpoch(): string | null {
  try {
    return localStorage.getItem(SESSION_EPOCH_KEY);
  } catch {
    return null;
  }
}

export function readTabSessionEpoch(): string | null {
  try {
    return sessionStorage.getItem(TAB_SESSION_EPOCH_KEY);
  } catch {
    return null;
  }
}

export function syncTabSessionEpochFromGlobal(): void {
  adoptGlobalSessionEpoch();
}

/** Align this tab with the browser-wide login epoch (safe for multiple tabs). */
export function adoptGlobalSessionEpoch(): void {
  const global = readGlobalSessionEpoch();
  if (!global) return;
  try {
    sessionStorage.setItem(TAB_SESSION_EPOCH_KEY, global);
  } catch {
    /* ignore */
  }
}

export function isSessionEpochStale(): boolean {
  const global = readGlobalSessionEpoch();
  if (!global) return false;

  const tab = readTabSessionEpoch();
  if (!tab) {
    adoptGlobalSessionEpoch();
    return false;
  }

  return global !== tab;
}

export function clearSessionEpoch(): void {
  try {
    localStorage.removeItem(SESSION_EPOCH_KEY);
    sessionStorage.removeItem(TAB_SESSION_EPOCH_KEY);
  } catch {
    /* ignore */
  }
}

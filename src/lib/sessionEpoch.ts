export const SESSION_EPOCH_KEY = 'grosafe_session_epoch';
export const TAB_SESSION_EPOCH_KEY = 'grosafe_tab_session_epoch';

export function bumpSessionEpoch(): string {
  const epoch = `${Date.now()}-${crypto.randomUUID()}`;
  localStorage.setItem(SESSION_EPOCH_KEY, epoch);
  sessionStorage.setItem(TAB_SESSION_EPOCH_KEY, epoch);
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
  const global = readGlobalSessionEpoch();
  if (global && !readTabSessionEpoch()) {
    sessionStorage.setItem(TAB_SESSION_EPOCH_KEY, global);
  }
}

export function isSessionEpochStale(): boolean {
  const global = readGlobalSessionEpoch();
  const tab = readTabSessionEpoch();
  return Boolean(global && tab && global !== tab);
}

export function clearSessionEpoch(): void {
  try {
    localStorage.removeItem(SESSION_EPOCH_KEY);
    sessionStorage.removeItem(TAB_SESSION_EPOCH_KEY);
  } catch {
    /* ignore */
  }
}

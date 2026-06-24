import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_EPOCH_KEY,
  TAB_SESSION_EPOCH_KEY,
  adoptGlobalSessionEpoch,
  bumpSessionEpoch,
  clearSessionEpoch,
  isSessionEpochStale,
  readGlobalSessionEpoch,
  readTabSessionEpoch,
} from '../sessionEpoch';

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('sessionEpoch', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('sessionStorage', createStorage());
    clearSessionEpoch();
  });

  it('bumpSessionEpoch sets matching global and tab epochs', () => {
    const epoch = bumpSessionEpoch();
    expect(readGlobalSessionEpoch()).toBe(epoch);
    expect(readTabSessionEpoch()).toBe(epoch);
    expect(isSessionEpochStale()).toBe(false);
  });

  it('adoptGlobalSessionEpoch aligns a new tab with an existing login', () => {
    localStorage.setItem(SESSION_EPOCH_KEY, 'existing-epoch');
    sessionStorage.removeItem(TAB_SESSION_EPOCH_KEY);

    adoptGlobalSessionEpoch();

    expect(readTabSessionEpoch()).toBe('existing-epoch');
    expect(isSessionEpochStale()).toBe(false);
  });

  it('isSessionEpochStale when tab epoch differs from global', () => {
    localStorage.setItem(SESSION_EPOCH_KEY, 'global-epoch');
    sessionStorage.setItem(TAB_SESSION_EPOCH_KEY, 'old-tab-epoch');
    expect(isSessionEpochStale()).toBe(true);
  });

  it('clearSessionEpoch removes both keys', () => {
    bumpSessionEpoch();
    clearSessionEpoch();
    expect(localStorage.getItem(SESSION_EPOCH_KEY)).toBeNull();
    expect(sessionStorage.getItem(TAB_SESSION_EPOCH_KEY)).toBeNull();
  });
});

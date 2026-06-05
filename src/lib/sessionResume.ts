import { debugLog } from '@/lib/debugLog';

type ResumeListener = () => void;

const resumeListeners = new Set<ResumeListener>();

/** Subscribe to app resume after token refresh / tab wake. */
export function onSessionResume(listener: ResumeListener): () => void {
  resumeListeners.add(listener);
  return () => {
    resumeListeners.delete(listener);
  };
}

/** Ask auth layer to sign out when a data loader cannot obtain a valid session. */
export function notifySessionInvalid(reason: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:session-invalid', { detail: { reason } }));
  }
}

/** Notify all listeners that the auth session is fresh and data should reload. */
export function notifySessionResume(): void {
  debugLog('sessionResume.ts:notify', 'notifySessionResume', {
    listenerCount: resumeListeners.size,
  }, 'C');
  resumeListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[sessionResume] listener failed:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:session-resume'));
  }
}

type ResumeListener = () => void;

const resumeListeners = new Set<ResumeListener>();

/** Minimum gap between global resume reload bursts (avoids form resets on tab focus). */
const RESUME_NOTIFY_MIN_GAP_MS = 8_000;
let lastResumeNotifyAt = 0;
let resumeNotifyTimer: ReturnType<typeof setTimeout> | null = null;

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

function dispatchSessionResume(): void {
  lastResumeNotifyAt = Date.now();
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

/** Notify listeners that the auth session was refreshed and background reload is useful. */
export function notifySessionResume(): void {
  const now = Date.now();
  const elapsed = now - lastResumeNotifyAt;

  if (elapsed >= RESUME_NOTIFY_MIN_GAP_MS) {
    if (resumeNotifyTimer) {
      clearTimeout(resumeNotifyTimer);
      resumeNotifyTimer = null;
    }
    dispatchSessionResume();
    return;
  }

  if (resumeNotifyTimer) return;

  resumeNotifyTimer = setTimeout(() => {
    resumeNotifyTimer = null;
    dispatchSessionResume();
  }, RESUME_NOTIFY_MIN_GAP_MS - elapsed);
}

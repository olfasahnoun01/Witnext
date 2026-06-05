type ResumeListener = () => void;

const resumeListeners = new Set<ResumeListener>();

/** Subscribe to app resume after token refresh / tab wake. */
export function onSessionResume(listener: ResumeListener): () => void {
  resumeListeners.add(listener);
  return () => {
    resumeListeners.delete(listener);
  };
}

/** Notify all listeners that the auth session is fresh and data should reload. */
export function notifySessionResume(): void {
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

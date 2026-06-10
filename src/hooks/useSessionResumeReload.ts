import { useEffect, useRef } from 'react';
import { onSessionResume } from '@/lib/sessionResume';

/** Re-run `reload` when the app wakes up with a refreshed Supabase session. */
export function useSessionResumeReload(reload: () => void | Promise<void>) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    return onSessionResume(() => {
      // Brief delay so auth refresh (same wake event) finishes before data loaders run.
      window.setTimeout(() => {
        void reloadRef.current();
      }, 300);
    });
  }, []);
}
